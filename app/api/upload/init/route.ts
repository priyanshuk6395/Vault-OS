import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "node:crypto";

// Local Infrastructure Imports
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";
import { getEventAuthorization, getGuestPersonId } from "@/lib/guest-session";

// AWS SDK Imports
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { deleteEventFacesForImage } from "@/lib/rekognition";

const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId, uploaderId } = body;
    if (typeof eventId !== "string" || !eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const { event, isOwner, isGuest } = await getEventAuthorization(eventId);
    if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isGuest && event.guestUploadPolicy !== "allowed") {
      return NextResponse.json({ error: "Guest uploads are disabled for this event." }, { status: 403 });
    }

    const isBatch = Array.isArray(body.files);
    const files = isBatch ? body.files : [{
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      assetType: body.assetType,
      clientUploadId: body.clientUploadId,
    }];
    if (files.length === 0 || files.length > 100) {
      return NextResponse.json({ error: "files must contain between 1 and 100 items." }, { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const validatedFiles = [];
    for (const file of files) {
      if (
        typeof file?.filename !== "string" || !file.filename.trim() ||
        typeof file.contentType !== "string" ||
        !Number.isSafeInteger(file.size) || file.size <= 0 ||
        !["image", "video"].includes(file.assetType)
      ) {
        return NextResponse.json({ error: "Each file requires filename, contentType, positive size, and assetType image or video." }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Payload exceeds 50MB limit." }, { status: 413 });
      }
      const expectedContentPrefix = file.assetType === "video" ? "video/" : "image/";
      if (!file.contentType.startsWith(expectedContentPrefix)) {
        return NextResponse.json({ error: "File contentType does not match assetType." }, { status: 400 });
      }
      if (file.clientUploadId !== undefined && (
        typeof file.clientUploadId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(file.clientUploadId)
      )) {
        return NextResponse.json({ error: "clientUploadId must be a UUID." }, { status: 400 });
      }
      validatedFiles.push(file as { filename: string; contentType: string; size: number; assetType: string; clientUploadId?: string });
    }

    let resolvedUploaderId: string | null = isOwner ? event.ownerId : null;
    if (isGuest) {
      if (typeof uploaderId !== "string" || !uploaderId) {
        return NextResponse.json({ error: "A guest uploader identity is required." }, { status: 400 });
      }
      if (await getGuestPersonId(eventId) !== uploaderId) {
        return NextResponse.json({ error: "Guest identity has not been verified for this person." }, { status: 403 });
      }
      const person = await prisma.person.findFirst({
        where: { id: uploaderId, eventId },
        select: { id: true },
      });
      if (!person) return NextResponse.json({ error: "Guest uploader identity is invalid for this event." }, { status: 403 });
      resolvedUploaderId = person.id;
    }

    const folderName = isOwner ? "approved" : "pending";
    const prepared = validatedFiles.map((file, clientIndex) => {
      const assetId = file.clientUploadId || uuidv4();
      const extension = file.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const rawSegment = process.env.MEDIA_PROCESSING_MODE === "lambda" ? "/raw" : "";
      const storageKey = `events/${eventId}/${folderName}${rawSegment}/${assetId}.${extension}`;
      return { file, clientIndex, assetId, storageKey };
    });

    const existingAssets = await prisma.asset.findMany({
      where: { id: { in: prepared.map(({ assetId }) => assetId) } },
      select: { id: true, eventId: true, sourceFilename: true, assetType: true, mimeType: true, fileSize: true, uploaderId: true, status: true, jobStartedAt: true, awsJobId: true, errorMessage: true },
    });
    const existingById = new Map(existingAssets.map((asset) => [asset.id, asset]));
    for (const { file, assetId } of prepared) {
      const existing = existingById.get(assetId);
      if (existing && (
        existing.eventId !== eventId ||
        existing.sourceFilename !== file.filename ||
        existing.assetType !== file.assetType ||
        existing.mimeType !== file.contentType ||
        existing.fileSize !== file.size ||
        existing.uploaderId !== resolvedUploaderId ||
        (
          !["uploading", "uploaded", "failed"].includes(existing.status) &&
          !(existing.status === "processing" && existing.jobStartedAt && Date.now() - existing.jobStartedAt.getTime() >= PROCESSING_STALE_AFTER_MS)
        )
      )) {
        return NextResponse.json({ error: "clientUploadId is already associated with another upload." }, { status: 409 });
      }
    }
    const newAssets = prepared.filter(({ assetId }) => !existingById.has(assetId));
    const processingCutoff = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);
    const retryAssetIds = existingAssets
      .filter((asset) => asset.status === "failed" || asset.errorMessage?.startsWith("RETRY_CLEANUP_PENDING:") || (
        asset.status === "processing" && asset.jobStartedAt && asset.jobStartedAt < processingCutoff
      ))
      .map((asset) => asset.id);

    const retryAssets = existingAssets.filter((asset) => retryAssetIds.includes(asset.id));

    if (retryAssetIds.length > 0) {
      const cleanupClaim = `RETRY_CLEANUP_PENDING:${randomUUID()}`;
      const claim = await prisma.asset.updateMany({
        where: {
          id: { in: retryAssetIds },
          eventId,
          OR: [
            { status: "failed" },
            { status: "uploading", errorMessage: { startsWith: "RETRY_CLEANUP_PENDING:" } },
            { status: "processing", jobStartedAt: { lt: processingCutoff } },
          ],
        },
        data: {
          status: "uploading",
          jobStartedAt: null,
          jobCompletedAt: null,
          errorMessage: cleanupClaim,
        },
      });
      if (claim.count !== retryAssetIds.length) {
        return NextResponse.json({ error: "Upload changed while retry was being prepared." }, { status: 409 });
      }

      for (const asset of retryAssets) {
        await deleteEventFacesForImage(eventId, [asset.awsJobId, asset.id].filter((id): id is string => !!id));
      }

      const cleanupComplete = await prisma.asset.updateMany({
        where: { id: { in: retryAssetIds }, eventId, status: "uploading", errorMessage: cleanupClaim },
        data: { errorMessage: "RETRY_PENDING" },
      });
      if (cleanupComplete.count !== retryAssetIds.length) {
        return NextResponse.json({ error: "Upload retry cleanup was interrupted." }, { status: 409 });
      }
    }

    if (newAssets.length > 0) await prisma.$transaction(newAssets.map(({ file, assetId, storageKey }) => prisma.asset.create({
      data: {
        id: assetId,
        eventId,
        sourceFilename: file.filename,
        storageKey,
        assetType: file.assetType,
        status: "uploading",
        moderationState: isOwner ? "approved" : "pending",
        mimeType: file.contentType,
        fileSize: file.size,
        uploaderId: resolvedUploaderId,
      },
    })));
    const items = await Promise.all(prepared.map(async ({ file, clientIndex, assetId, storageKey }) => {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: storageKey,
        ContentType: file.contentType,
      });
      return { clientIndex, assetId, uploadUrl: await getSignedUrl(s3Client, command, { expiresIn: 300 }) };
    }));

    if (isBatch) return NextResponse.json({ items });
    return NextResponse.json({ uploadUrl: items[0].uploadUrl, assetId: items[0].assetId });

  } catch (error: unknown) {
    console.error(" [SYSTEM_FAILURE] UPLOAD_INIT_PIPELINE:", error);
    return NextResponse.json(
      { error: "Infrastructure Handshake Failed" }, 
      { status: 500 }
    );
  }
}