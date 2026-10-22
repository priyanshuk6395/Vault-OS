import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CopyObjectCommand,DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/lib/aws';
import { getEventAuthorization } from '@/lib/guest-session';
import { deleteEventFacesForImage } from '@/lib/rekognition';

export async function POST(req: Request) {
  try {
    const { assetId, action } = await req.json();

    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found in Vault." }, { status: 404 });
    }
    const { isOwner } = await getEventAuthorization(asset.eventId);
    if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Unsupported moderation action." }, { status: 400 });
    }

    if (action === 'approve') {
      const approvalClaim = await prisma.asset.updateMany({
        where: { id: asset.id, eventId: asset.eventId, status: "processed", moderationState: "pending" },
        data: { status: "approving" },
      });
      if (approvalClaim.count === 0) {
        return NextResponse.json({ error: "Asset changed before approval." }, { status: 409 });
      }

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
          await prisma.asset.updateMany({
            where: { id: asset.id, status: "approving" },
            data: { status: "processed", errorMessage: "Approval migration failed." },
          });
          return NextResponse.json(
            { error: "Failed to migrate asset in infrastructure." }, 
            { status: 500 }
          );
        }
      }

      // 2. APPROVAL PROTOCOL: Database Update
      const approval = await prisma.asset.updateMany({
        where: { id: assetId, status: "approving", moderationState: "pending" },
        data: { 
          storageKey: newKey,         // IMPORTANT: Update the DB with the new path
          status: 'processed',        // Confirms pipeline completion
          moderationState: 'approved' // Unlocks visibility in the gallery
        }
      });
      if (approval.count === 0) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: newKey }));
        return NextResponse.json({ error: "Asset approval lost its state claim." }, { status: 409 });
      }

    } else if (action === 'reject') {
      // 3. REJECTION PROTOCOL: Scorched Earth

      if (asset.status === "processing" || asset.status === "approving" || asset.status === "deleting") {
        return NextResponse.json({ error: "Asset is currently being processed." }, { status: 409 });
      }

      const deletionClaim = await prisma.asset.updateMany({
        where: { id: asset.id, eventId: asset.eventId, status: asset.status },
        data: { status: "deleting" },
      });
      if (deletionClaim.count === 0) {
        return NextResponse.json({ error: "Asset changed before rejection." }, { status: 409 });
      }

      await deleteEventFacesForImage(asset.eventId, [asset.awsJobId, asset.id].filter((id): id is string => !!id));
      
      try {
        // Delete from S3 first to ensure storage efficiency
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: asset.storageKey,
        }));
      } catch (s3Err) {
        // Log the error, but don't stop the DB purge
        console.warn("[S3_REJECT_CLEANUP_ERROR]:", s3Err);
        console.warn(`[Vault OS] Orphaned S3 object on reject: ${asset.storageKey}`);
        await prisma.asset.updateMany({
          where: { id: asset.id, status: "deleting" },
          data: { status: "failed", errorMessage: "S3 deletion failed during rejection." },
        });
        return NextResponse.json({ error: "Failed to delete asset from storage." }, { status: 500 });
      }

      // Deleting the Asset triggers Cascade Delete for faceDetections 
      // due to your schema's 'onDelete: Cascade' setting.
      await prisma.asset.delete({
        where: { id: assetId }
      });
    }

    return NextResponse.json({ success: true });
    
  } catch (error: unknown) {
    console.error("MODERATION_ERROR:", error);
    return NextResponse.json(
      { error: "Moderation protocol failed" }, 
      { status: 500 }
    );
  }
}