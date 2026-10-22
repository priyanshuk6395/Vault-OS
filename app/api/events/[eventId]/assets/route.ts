import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws"; 
import { getEventAuthorization } from "@/lib/guest-session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> } 
) {
  try {
    const { eventId } = await params;

    const { event, isOwner, isGuest } = await getEventAuthorization(eventId);

    if (!event) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    if (!isOwner && !isGuest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isGuest && !event.publicGallery) {
      return NextResponse.json({ error: "Public gallery is disabled for this vault." }, { status: 403 });
    }

    // 2. Fetch all Persons in this event to map Guest Uploaders
    // We only select what we need to save memory
    const personsRaw = await prisma.person.findMany({
      where: { eventId },
      select: { id: true, name: true }
    });
    
    // Create a high-performance Hash Map for O(1) lookups
    const personMap = new Map(personsRaw.map(p => [p.id, p.name]));

    // 3. Enforce the moderation gate (Fetch Assets)
    const assetsRaw = await prisma.asset.findMany({
      where: { 
        eventId,
        ...(isGuest ? { moderationState: "approved" } : {}),
        ...(isGuest ? { status: "processed" } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Map S3 URLs and Resolve Identities
    const assets = await Promise.all(
      assetsRaw.map(async (asset) => {
        let url = null;
        
        // --- S3 Presigning ---
        if (asset.storageKey) {
          try {
            const command = new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Key: asset.storageKey,
            });
            url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
          } catch (s3Error) {
            console.error(`S3 Signature Failed for ${asset.id}:`, s3Error);
          }
        }

        // --- IDENTITY RESOLUTION ENGINE ---
        let uploader = { name: "System", role: "Ingestion" };

        if (asset.uploaderId) {
          // Check if it's the Admin
          if (asset.uploaderId === 'admin' || asset.uploaderId === event.ownerId) {
            uploader = { name: "Vault Admin", role: "Administrator" };
          } 
          // Check if it's a known Guest (Person)
          else if (personMap.has(asset.uploaderId)) {
            uploader = { 
              name: personMap.get(asset.uploaderId) || "Unnamed Guest", 
              role: "Guest User" 
            };
          } 
          // Edge case: Unknown ID
          else {
            uploader = { name: "Unknown Client", role: "External Node" };
          }
        }

        // Return the merged object that the frontend is expecting
        return { ...asset, url, uploader };
      })
    );

    const response = NextResponse.json(assets);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("Fetch Assets Error:", error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}