import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws"; 

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> } 
) {
  try {
    const { eventId } = await params;

    // 1. Fetch Event to identify the Admin/Owner
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true }
    });

    if (!event) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
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
        // NOTE: If you want admins to see pending images in the main grid, remove this line!
        // Otherwise, keep it so only approved ones show up here.
        // moderationState: 'approved' 
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

    return NextResponse.json(assets);
  } catch (error) {
    console.error("Fetch Assets Error:", error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}