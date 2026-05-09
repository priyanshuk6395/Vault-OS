"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { rekognitionClient,s3Client } from "@/lib/aws";
import { DeleteCollectionCommand, DescribeCollectionCommand } from "@aws-sdk/client-rekognition";
import { GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function rotateEventPasscode(eventId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");

  // Generate a new 8-character uppercase passcode
  const newPasscode = Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    await prisma.event.update({
      where: { 
        id: eventId,
        ownerId: session.user.id // Security: Ensure only the owner can rotate
      },
      data: { passcode: newPasscode },
    });

    // Refresh the page data immediately
    revalidatePath(`/admin/${eventId}/access`);
    return { success: true, newPasscode };
  } catch (error) {
    console.error("Rotation failed:", error);
    return { success: false };
  }
}

/**
 * Aggregates database metrics and pings AWS services for a live health check.
 */
export async function getEventSettings(eventId: string) {
  const eventData = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      passcode: true,
      createdAt: true,
      _count: {
        select: {
          assets: true,
          persons: true,
        }
      },
      assets: {
        select: {
          _count: {
            select: { faceDetections: true }
          }
        }
      }
    }
  });

  if (!eventData) return null;

  const health = { database: true, s3: false, rekognition: false };

  // --- FIXED S3 HEALTH CHECK ---
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    
    if (!bucketName) {
      console.error("S3_HEALTH_ERROR: AWS_S3_BUCKET env variable is missing");
      health.s3 = false;
    } else {
      // Validates bucket existence and connectivity
      await s3Client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
      health.s3 = true;
    }
  } catch (e: any) {
    // Removed the non-existent 'file.name' reference that caused the crash
    console.error(`S3_HEALTH_ERROR for Event ${eventId}:`, e.name, e.message);
    health.s3 = false;
  }

  // --- REKOGNITION HEALTH CHECK ---
  try {
    const collectionId = `event-${eventId}`;
    await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    health.rekognition = true;
  } catch (e) { 
    health.rekognition = false; 
  }

  const totalFaces = eventData.assets.reduce((acc, curr) => acc + curr._count.faceDetections, 0);

  return { ...eventData, totalFaces, health };
}

/**
 * Purges the entire event infrastructure including AWS Collections and local DB records.
 */
export async function deleteEvent(eventId: string) {
  try {
    const collectionId = `event-${eventId}`;
    // Attempt to delete the AWS Collection first
    try {
      await rekognitionClient.send(new DeleteCollectionCommand({ CollectionId: collectionId }));
    } catch (e) { console.warn("Collection already deleted or missing."); }

    await prisma.event.delete({ where: { id: eventId } });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to purge infrastructure" };
  }
}

export async function logoutGuest(eventId: string) {
  const cookieStore = await cookies();
  
  // Delete the specific event authorization cookie
  cookieStore.delete(`event_auth_${eventId}`);
  
  // Redirect to the entry gate
  redirect(`/guest/event/${eventId}`);
}