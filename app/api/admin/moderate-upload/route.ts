import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/lib/aws';

export async function POST(req: Request) {
  try {
    const { assetId, action, eventId } = await req.json();

    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (action === 'approve') {
      // 1. APPROVE: Flip visibility to 'approved'
      // The AI has already set status to 'processed' in the background.
      await prisma.asset.update({
        where: { id: assetId },
        data: { 
          status: 'processed',      // Confirms pipeline completion
          moderationState: 'approved' // Unlocks visibility in the gallery
        }
      });
    } else {
      // 2. REJECT: Full System Cleanup
      // Delete from S3 first to ensure storage efficiency
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: asset.storageKey,
        }));
      } catch (s3Err) {
        console.error("Cleanup failed in S3, but deleting DB record anyway.");
      }

      // Deleting the Asset will trigger Cascade Delete for faceDetections 
      // due to your schema's 'onDelete: Cascade' setting.
      await prisma.asset.delete({
        where: { id: assetId }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("MODERATION_ERROR:", error);
    return NextResponse.json({ error: "Moderation protocol failed" }, { status: 500 });
  }
}