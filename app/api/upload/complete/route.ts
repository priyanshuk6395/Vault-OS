import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  IndexFacesCommand,
  SearchFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
  type FaceRecord,
} from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '@/lib/aws';
import { s3Client } from '@/lib/aws';
import { deleteEventFaceIds } from '@/lib/rekognition';
import { getEventAuthorization, getGuestPersonId } from '@/lib/guest-session';
import pLimit from 'p-limit';
import sharp from 'sharp';

const limitFaceMatching = pLimit(5);

function hasErrorName(error: unknown, name: string) {
  return error instanceof Error && error.name === name;
}

async function isCurrentProcessingAttempt(assetId: string, startedAt: Date, attemptId: string) {
  return !!await prisma.asset.findFirst({
    where: { id: assetId, status: "processing", jobStartedAt: startedAt, awsJobId: attemptId },
    select: { id: true },
  });
}

export async function POST(req: Request) {
  let currentAssetId = "";
  let processingStartedAt: Date | null = null;
  let processingAttemptId: string | null = null;
  try {
    const { assetId, uploaderId } = await req.json();

    if (!assetId || typeof assetId !== 'string') {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }
    // 1. FETCH ASSET
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    const { event, isOwner, isGuest } = await getEventAuthorization(asset.eventId);
    if (!event) return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    if (!isOwner && !isGuest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwner) {
      if (
        asset.moderationState !== 'pending' ||
        asset.uploaderId !== uploaderId ||
        typeof uploaderId !== 'string' ||
        await getGuestPersonId(asset.eventId) !== uploaderId
      ) {
        return NextResponse.json({ error: 'Upload is not authorized for this guest.' }, { status: 403 });
      }
      const uploader = await prisma.person.findFirst({
        where: { id: uploaderId, eventId: asset.eventId },
        select: { id: true },
      });
      if (!uploader) return NextResponse.json({ error: 'Guest uploader identity is invalid for this event.' }, { status: 403 });
    }
    if (isGuest && event.guestUploadPolicy !== 'allowed') {
      return NextResponse.json({ error: 'Guest uploads are disabled for this event.' }, { status: 403 });
    }
    currentAssetId = assetId;

    if (asset.status === 'processed') {
      const detected = await prisma.faceDetection.count({ where: { assetId } });
      return NextResponse.json({ success: true, detected, moderated: asset.moderationState === 'pending' });
    }
    if (asset.status !== 'uploading' && asset.status !== 'uploaded') {
      if (asset.status === 'processing') {
        return NextResponse.json({ success: true, processing: true }, { status: 202 });
      }
      return NextResponse.json({ error: 'Asset is not ready for processing.' }, { status: 409 });
    }

    processingStartedAt = new Date();
    processingAttemptId = randomUUID();
    const processingClaim = await prisma.asset.updateMany({
      where: { id: assetId, status: { in: ['uploading', 'uploaded'] } },
      data: { status: 'processing', jobStartedAt: processingStartedAt, awsJobId: processingAttemptId },
    });
    if (processingClaim.count === 0) {
      const currentAsset = await prisma.asset.findUnique({ where: { id: assetId }, select: { status: true, moderationState: true } });
      if (currentAsset?.status === 'processed') {
        const detected = await prisma.faceDetection.count({ where: { assetId } });
        return NextResponse.json({ success: true, detected, moderated: currentAsset.moderationState === 'pending' });
      }
      if (currentAsset?.status === 'processing') {
        return NextResponse.json({ success: true, processing: true }, { status: 202 });
      }
      return NextResponse.json({ error: 'Asset is not ready for processing.' }, { status: 409 });
    }

    const priorDetections = await prisma.faceDetection.findMany({
      where: { assetId },
      select: { personId: true },
    });
    if (priorDetections.length > 0) {
      const priorPersonIds = [...new Set(priorDetections.map((detection) => detection.personId))];
      await prisma.$transaction([
        prisma.faceSample.deleteMany({ where: { faceDetection: { assetId } } }),
        prisma.faceDetection.deleteMany({ where: { assetId } }),
        prisma.person.deleteMany({
          where: {
            id: { in: priorPersonIds },
            faceDetections: { none: {} },
            samples: { none: {} },
          },
        }),
      ]);
    }

    // 2. STATE LOGIC: Determine if this came from a guest
    // Based on your schema, we use moderationState to gate visibility
    const isGuestUpload = asset.moderationState === 'pending';

    // Update status to track AI pipeline activity
    const collectionId = `event-${asset.eventId}`;

    const isVideo = asset.assetType === 'video' || asset.mimeType?.startsWith('video/');
    let faceRecords: FaceRecord[] = [];

    if (!isVideo) {
      try {
        await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      } catch (error: unknown) {
        if (hasErrorName(error, 'ResourceNotFoundException')) {
          try {
            await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
          } catch (createError: unknown) {
            if (!hasErrorName(createError, 'ResourceAlreadyExistsException')) throw createError;
          }
        } else {
          throw error;
        }
      }

      const isWebp = asset.storageKey.toLowerCase().endsWith('.webp') || asset.mimeType === 'image/webp';
      const image = isWebp
        ? await (async () => {
            const response = await s3Client.send(new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Key: asset.storageKey,
            }));
            if (!response.Body) throw new Error('Uploaded image is not available in S3');
            const bytes = await response.Body.transformToByteArray();
            const jpegBuffer = await sharp(Buffer.from(bytes)).rotate().jpeg({ quality: 90 }).toBuffer();
            return { Bytes: jpegBuffer };
          })()
        : { S3Object: { Bucket: process.env.AWS_S3_BUCKET, Name: asset.storageKey } };

      const indexResponse = await rekognitionClient.send(new IndexFacesCommand({
        CollectionId: collectionId,
        Image: image,
        ExternalImageId: processingAttemptId,
        DetectionAttributes: ["ALL"],
      }));

      faceRecords = indexResponse.FaceRecords || [];
      if (!await isCurrentProcessingAttempt(asset.id, processingStartedAt, processingAttemptId)) {
        await deleteEventFaceIds(asset.eventId, faceRecords.map((record) => record.Face?.FaceId).filter((faceId): faceId is string => !!faceId));
        return NextResponse.json({ success: true, processing: true }, { status: 202 });
      }

      if (faceRecords.length >= 3) {
        const avgConfidence = faceRecords.reduce((acc, f) => acc + (f.Face?.Confidence || 0), 0) / faceRecords.length;

        if (avgConfidence > 90) {
          await prisma.event.updateMany({
            where: { id: asset.eventId, themeImageUrl: null },
            data: { themeImageUrl: asset.storageKey }
          });
        }
      }

    }

    const searchResults = await Promise.all(faceRecords.map(record => limitFaceMatching(async () => {
      const faceId = record.Face?.FaceId;
      if (!faceId) return { record, faceId: null, matchIds: [] as string[], existingPersonId: null as string | null };

      const searchResponse = await rekognitionClient.send(new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: faceId,
        FaceMatchThreshold: 90,
        MaxFaces: 5,
      }));

      const matches = searchResponse.FaceMatches?.filter(m => m.Face?.FaceId !== faceId) || [];
      const matchIds = matches.map(m => m.Face?.FaceId).filter(Boolean) as string[];
      const existingPerson = matchIds.length > 0
        ? await prisma.faceDetection.findFirst({
            where: { faceId: { in: matchIds } },
            orderBy: { createdAt: 'asc' },
            select: { personId: true },
          })
        : null;
      return { record, faceId, matchIds, existingPersonId: existingPerson?.personId ?? null };
    })));

    const personByFaceId = new Map<string, string>();
    for (const { record, faceId, matchIds, existingPersonId } of searchResults) {
      if (!faceId) continue;
      let personId = existingPersonId;
      if (!personId) {
        for (const matchId of matchIds) {
          personId = personByFaceId.get(matchId) ?? null;
          if (personId) break;
        }
      }

      const committedPersonId = await prisma.$transaction(async (tx) => {
        const claim = await tx.asset.updateMany({
          where: { id: asset.id, status: "processing", jobStartedAt: processingStartedAt!, awsJobId: processingAttemptId },
          data: { jobStartedAt: processingStartedAt! },
        });
        if (claim.count === 0) return null;

        let resolvedPersonId = personId;
        if (!resolvedPersonId) {
          const newPerson = await tx.person.create({
            data: { eventId: asset.eventId, status: 'unnamed' },
          });
          resolvedPersonId = newPerson.id;
        }

        await tx.faceDetection.upsert({
          where: { faceId },
          update: { assetId: asset.id, personId: resolvedPersonId },
          create: {
            id: faceId,
            faceId,
            assetId: asset.id,
            personId: resolvedPersonId,
            confidence: record.Face?.Confidence || 0,
            boundingBox: JSON.parse(JSON.stringify(record.Face?.BoundingBox ?? {})) as Prisma.InputJsonValue,
          },
        });
        await tx.faceSample.upsert({
          where: { personId_faceDetectionId: { personId: resolvedPersonId, faceDetectionId: faceId } },
          update: {},
          create: { personId: resolvedPersonId, faceDetectionId: faceId, isReference: true },
        });
        return resolvedPersonId;
      });
      if (!committedPersonId) {
        await deleteEventFaceIds(asset.eventId, [faceId]);
        return NextResponse.json({ success: true, processing: true }, { status: 202 });
      }
      personByFaceId.set(faceId, committedPersonId);
    }

    // 6. FINAL STATUS GATE
    // We update the 'status' to indicate AI is done.
    // 'moderationState' remains 'pending' for guests, or 'approved' for admins.
    const completion = await prisma.asset.updateMany({
      where: { id: assetId, status: "processing", jobStartedAt: processingStartedAt!, awsJobId: processingAttemptId },
      data: {
        status: 'processed',
        jobCompletedAt: new Date(),
        moderationState: isGuestUpload ? 'pending' : 'approved'
      }
    });
    if (completion.count === 0) {
      await deleteEventFaceIds(asset.eventId, faceRecords.map((record) => record.Face?.FaceId).filter((faceId): faceId is string => !!faceId));
      return NextResponse.json({ success: true, processing: true }, { status: 202 });
    }

    return NextResponse.json({
      success: true,
      detected: faceRecords.length,
      moderated: isGuestUpload
    });

  } catch (error: unknown) {
    console.error("Processing Error:", error);
    if (currentAssetId) {
      try {
        await prisma.asset.updateMany({
          where: {
            id: currentAssetId,
            status: "processing",
            jobStartedAt: processingStartedAt ?? undefined,
            awsJobId: processingAttemptId ?? undefined,
          },
          data: { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) }
        });
      } catch (updateErr) {
        console.error("Failed to record failure state:", updateErr);
      }
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}