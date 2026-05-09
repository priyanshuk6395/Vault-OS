import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/lib/aws';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ eventId: string, assetId: string }> }
) {
  const { eventId, assetId } = await params;

  try {
    // 1. Fetch asset and associated people before deletion
    const asset = await prisma.asset.findUnique({
      where: { id: assetId, eventId },
      include: {
        faceDetections: {
          select: { personId: true }
        }
      }
    });

    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    // 2. Physical Layer: Delete from S3
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: asset.storageKey,
    }));

    // 3. Logic Layer: Transactional Database Cleanup
    // We use a transaction to ensure database integrity
    await prisma.$transaction(async (tx) => {
      // a. Extract the IDs of people featured in this photo
      const involvedPersonIds = asset.faceDetections.map(fd => fd.personId);

      // b. Delete Face Detections and Sample references first (if not cascading)
      await tx.faceSample.deleteMany({
        where: { faceDetection: { assetId } }
      });
      await tx.faceDetection.deleteMany({ where: { assetId } });

      // c. Delete the Asset itself
      await tx.asset.delete({ where: { id: assetId } });

      // d. GARBAGE COLLECTION: Clean up orphaned people
      // Only delete people who NO LONGER have any detections in the entire database
      if (involvedPersonIds.length > 0) {
        for (const pId of involvedPersonIds) {
          const remainingDetections = await tx.faceDetection.count({
            where: { personId: pId }
          });

          if (remainingDetections === 0) {
            await tx.person.delete({ where: { id: pId } });
          }
        }
      }
    });

    return NextResponse.json({ success: true, message: "Asset and orphaned identities cleared." });
  } catch (error) {
    console.error("DELETE_ERROR:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}