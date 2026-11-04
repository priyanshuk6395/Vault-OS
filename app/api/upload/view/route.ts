import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/aws";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ownsEvent } from "@/lib/auth";
import { getEventAuthorization, guestCanAccessAsset, getGuestPersonId } from "@/lib/guest-session";
import sharp from "sharp";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) return new NextResponse("Not Found", { status: 404 });

  let mediaAssetId: string | undefined;
  let mediaEventId: string | undefined;
  try {
    const asset = await prisma.asset.findFirst({
      where: { storageKey: key },
      select: {
        id: true,
        eventId: true,
        status: true,
        moderationState: true,
        assetType: true,
        mimeType: true,
        event: { select: { ownerId: true } },
      },
    });
    mediaAssetId = asset?.id;
    mediaEventId = asset?.eventId;
    const session = await getServerSession(authOptions);
    let eventId = asset?.eventId;
    let isOwner = !!asset && ownsEvent(asset.event.ownerId, session?.user?.id);
    let isGuest = false;

    if (asset) {
      const { event, isGuest: hasEventAccess } = await getEventAuthorization(asset.eventId);
      isGuest = hasEventAccess;
      const personId = event?.publicGallery || !event?.biometricSearch ? null : await getGuestPersonId(asset.eventId);
      const hasPersonalAccess = !!event && !event.publicGallery && await guestCanAccessAsset(asset.eventId, personId, asset.id);
      const isApprovedProcessed = asset.moderationState === "approved" && asset.status === "processed";
      if (!isOwner && (!isGuest || (event?.publicGallery ? !isApprovedProcessed : !hasPersonalAccess))) {
        return new NextResponse("Access Denied", { status: 403 });
      }
    } else if (session?.user?.id) {
      const themeEvent = await prisma.event.findFirst({
        where: { themeImageUrl: key },
        select: { id: true, ownerId: true },
      });
      if (themeEvent && ownsEvent(themeEvent.ownerId, session.user.id)) {
        eventId = themeEvent.id;
        isOwner = true;
      }
    }
    if (!eventId) return new NextResponse("Not Found", { status: 404 });
    if (!isOwner && !isGuest) return new NextResponse("Access Denied", { status: 403 });
    if (asset && (asset.assetType === "video" || asset.mimeType?.startsWith("video/"))) {
      return new NextResponse("Unsupported media type", { status: 415 });
    }

    const widthParam = searchParams.get("w");
    const width = widthParam === null ? undefined : Number(widthParam);
    if (widthParam !== null && (!Number.isInteger(width) || width! < 1 || width! > 4096)) {
      return NextResponse.json({ error: "w must be an integer between 1 and 4096." }, { status: 400 });
    }
    const format = searchParams.get("format");
    if (format && !["webp", "jpeg", "png", "avif"].includes(format)) {
      return NextResponse.json({ error: "Unsupported output format." }, { status: 400 });
    }
    const qualityParam = searchParams.get("q");
    const quality = qualityParam === null ? 82 : Number(qualityParam);
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      return NextResponse.json({ error: "q must be an integer between 1 and 100." }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const bytes = await s3Response.Body.transformToByteArray();
    const input = Buffer.from(bytes);
    const metadata = await sharp(input).metadata();
    const image = sharp(input).rotate();
    if (width !== undefined) image.resize({ width, withoutEnlargement: true });

    const supportedFormats = ["webp", "jpeg", "png", "avif"];
    const outputFormat = format || (supportedFormats.includes(metadata.format || "") ? metadata.format! : "jpeg");
    if (outputFormat === "webp") image.webp({ quality });
    else if (outputFormat === "jpeg") image.jpeg({ quality });
    else if (outputFormat === "png") image.png({ quality });
    else if (outputFormat === "avif") image.avif({ quality });
    const output = await image.toBuffer();

    return new NextResponse(output, {
      status: 200,
      headers: {
        "Content-Type": `image/${outputFormat}`,
        "Content-Length": String(output.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "Vary": "Cookie",
      },
    });
  } catch (error) {
    console.error("[UPLOAD_VIEW_ERROR]:", {
      eventId: mediaEventId,
      assetId: mediaAssetId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Media source unavailable", { status: 502 });
  }
}