import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  IndexFacesCommand,
  SearchFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand
} from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '@/lib/aws';

export async function POST(req: Request) {
  let currentAssetId = "";
  try {
    const { assetId } = await req.json();

    if (!assetId || typeof assetId !== 'string') {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }
    currentAssetId = assetId;

    // 1. FETCH ASSET
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // 2. STATE LOGIC: Determine if this came from a guest
    // Based on your schema, we use moderationState to gate visibility
    const isGuestUpload = asset.moderationState === 'pending';

    // Update status to track AI pipeline activity
    await prisma.asset.update({
      where: { id: assetId },
      data: { jobStartedAt: new Date() }
    });

    const collectionId = `event-${asset.eventId}`;

    // 3. AWS REKOGNITION: Infrastructure Check
    try {
      await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    } catch (e: any) {
      if (e.name === 'ResourceNotFoundException') {
        try {
          await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
        } catch (createErr: any) {
          // Two assets from the same brand-new event can both hit
          // ResourceNotFoundException before either creates the collection.
          // Whichever request loses that race isn't an actual failure —
          // the collection exists by the time we get here either way.
          if (createErr.name !== 'ResourceAlreadyExistsException') throw createErr;
        }
      } else {
        throw e;
      }
    }

    // 4. BIOMETRIC INDEXING
    const indexResponse = await rekognitionClient.send(new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { S3Object: { Bucket: process.env.AWS_S3_BUCKET, Name: asset.storageKey } },
      ExternalImageId: asset.id,
      DetectionAttributes: ["ALL"],
    }));

    const faceRecords = indexResponse.FaceRecords || [];

    if (faceRecords.length >= 3) {
      const avgConfidence = faceRecords.reduce((acc, f) => acc + (f.Face?.Confidence || 0), 0) / faceRecords.length;

      // Only auto-set the theme if the admin hasn't already picked one —
      // otherwise this silently overwrites a deliberate manual choice
      // every time a future high-quality group shot finishes processing.
      if (avgConfidence > 90) {
        await prisma.event.updateMany({
          where: { id: asset.eventId, themeImageUrl: null },
          data: { themeImageUrl: asset.storageKey }
        });
      }
    }

    // 5. IDENTITY RESOLUTION (Clustering)
    for (const record of faceRecords) {
      const faceId = record.Face?.FaceId;
      if (!faceId) continue;

      const searchResponse = await rekognitionClient.send(new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: faceId,
        FaceMatchThreshold: 90,
        MaxFaces: 5,
      }));

      let personId: string | null = null;
      const matches = searchResponse.FaceMatches?.filter(m => m.Face?.FaceId !== faceId) || [];

      if (matches.length > 0) {
        const matchIds = matches.map(m => m.Face?.FaceId).filter(Boolean) as string[];
        // orderBy createdAt asc: if a face matches people from more than one
        // existing cluster, resolve to the oldest match deterministically
        // rather than whatever order Postgres happens to return.
        const existingPerson = await prisma.faceDetection.findFirst({
          where: { faceId: { in: matchIds } },
          orderBy: { createdAt: 'asc' },
          select: { personId: true }
        });
        if (existingPerson) personId = existingPerson.personId;
      }

      if (!personId) {
        const newPerson = await prisma.person.create({
          data: { eventId: asset.eventId, status: 'unnamed' }
        });
        personId = newPerson.id;
      }

      await prisma.$transaction([
        prisma.faceDetection.upsert({
          where: { faceId }, // Using faceId unique constraint from your schema
          update: { assetId: asset.id, personId },
          create: {
            id: faceId,
            faceId,
            assetId: asset.id,
            personId,
            confidence: record.Face?.Confidence || 0,
            boundingBox: record.Face?.BoundingBox as any,
          }
        }),
        prisma.faceSample.upsert({
          where: { personId_faceDetectionId: { personId, faceDetectionId: faceId } },
          update: {},
          create: { personId, faceDetectionId: faceId, isReference: true }
        })
      ]);
    }

    // 6. FINAL STATUS GATE
    // We update the 'status' to indicate AI is done.
    // 'moderationState' remains 'pending' for guests, or 'approved' for admins.
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        status: 'processed',
        jobCompletedAt: new Date(),
        // Only set to 'approved' if it wasn't a guest upload
        moderationState: isGuestUpload ? 'pending' : 'approved'
      }
    });

    return NextResponse.json({
      success: true,
      detected: faceRecords.length,
      moderated: isGuestUpload
    });

  } catch (error: any) {
    console.error("Processing Error:", error);
    if (currentAssetId) {
      try {
        await prisma.asset.update({
          where: { id: currentAssetId },
          data: { status: 'failed', errorMessage: String(error?.message ?? error) }
        });
      } catch (updateErr) {
        console.error("Failed to record failure state:", updateErr);
      }
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}