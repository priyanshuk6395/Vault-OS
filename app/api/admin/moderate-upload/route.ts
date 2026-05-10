import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/lib/aws';

export async function POST(req: Request) {
  try {
    const { assetId, action } = await req.json();

    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found in Vault." }, { status: 404 });
    }

    if (action === 'approve') {
      // 1. APPROVAL PROTOCOL: S3 Migration
      const oldKey = asset.storageKey;
      
      // Transform the path from /pending/ to /approved/
      const newKey = oldKey.replace('/pending/', '/approved/');

      // Execute S3 "Move" (Copy + Delete)
      if (oldKey !== newKey) {
        try {
          // A. Copy to approved folder
          await s3Client.send(new CopyObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            // CopySource requires the format: bucket-name/path/to/key
            CopySource: `${process.env.AWS_S3_BUCKET}/${encodeURI(oldKey)}`,
            Key: newKey,
          }));

          // B. Delete original pending file
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: oldKey,
          }));
        } catch (s3Err) {
          console.error("[S3_MIGRATION_ERROR]:", s3Err);
          return NextResponse.json(
            { error: "Failed to migrate asset in infrastructure." }, 
            { status: 500 }
          );
        }
      }

      // 2. APPROVAL PROTOCOL: Database Update
      await prisma.asset.update({
        where: { id: assetId },
        data: { 
          storageKey: newKey,         // IMPORTANT: Update the DB with the new path
          status: 'processed',        // Confirms pipeline completion
          moderationState: 'approved' // Unlocks visibility in the gallery
        }
      });

    } else if (action === 'reject') {
      // 3. REJECTION PROTOCOL: Scorched Earth
      
      try {
        // Delete from S3 first to ensure storage efficiency
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: asset.storageKey,
        }));
      } catch (s3Err) {
        // Log the error, but don't stop the DB purge
        console.warn(`[Vault OS] Orphaned S3 object on reject: ${asset.storageKey}`);
      }

      // Deleting the Asset triggers Cascade Delete for faceDetections 
      // due to your schema's 'onDelete: Cascade' setting.
      await prisma.asset.delete({
        where: { id: assetId }
      });
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("MODERATION_ERROR:", error);
    return NextResponse.json(
      { error: "Moderation protocol failed" }, 
      { status: 500 }
    );
  }
}