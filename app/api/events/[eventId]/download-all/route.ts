import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { Readable, Writable } from "stream";

// Helper function to sanitize names for Windows/Mac file systems
function sanitizeFilenamePart(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, '_');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> } 
){
  const { eventId } = await params;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");

  if (!personId) return new Response("Unauthorized", { status: 401 });

  // 1. Resolve guest and event data correctly using Prisma relation filters
  const guestData = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      event: {
        select: { title: true } // Schema uses 'title' for events
      },
      faceDetections: {
        where: {
          asset: { // We must filter through the related Asset model
            eventId: eventId,
            status: 'processed',
            moderationState: 'approved'
          }
        },
        include: {
          asset: {
            select: { storageKey: true, sourceFilename: true }
          }
        }
      }
    }
  });

  // Verify data consistency (ensure the person actually belongs to this specific vault)
  if (!guestData || guestData.eventId !== eventId) {
    return new Response("Invalid request data", { status: 400 });
  }

  const personName = guestData.name || "Unknown_Guest";
  const eventName = guestData.event.title; 

  // Flatten the assets from the junction table detections
  const assets = guestData.faceDetections.map(fd => fd.asset);

  if (assets.length === 0) return new Response("No assets found", { status: 404 });

  // Construct dynamic folder and zip names
  const sanitizedPersonName = sanitizeFilenamePart(personName);
  const sanitizedEventName = sanitizeFilenamePart(eventName);
  const folderName = `${sanitizedEventName}-${sanitizedPersonName}`;
  const zipFileName = `${folderName}.zip`;

  // 2. Setup the Stream Channel
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  const archive = archiver("zip", { zlib: { level: 5 } });
  
  const nodeWritable = new Writable({
    write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
      writer.write(chunk).then(() => callback()).catch(callback);
    },
    final(callback: (error?: Error | null) => void) {
      writer.close().then(() => callback()).catch(callback);
    }
  });

  archive.pipe(nodeWritable);

  // 3. Ingest S3 objects into Archive
  (async () => {
    try {
      for (const asset of assets) {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: asset.storageKey,
        });

        const response = await s3Client.send(command);
        const body = response.Body as Readable;

        if (body) {
          const finalFileName = asset.sourceFilename || `${asset.storageKey.split('/').pop()}`;
          const internalFilePath = `${folderName}/${finalFileName}`;
          
          // Append explicitly inside the named folder
          archive.append(body, { name: internalFilePath });
        }
      }
      await archive.finalize();
    } catch (err) {
      console.error("Zipping error:", err);
      writer.abort(err);
    }
  })();

  // 4. Return dynamic stream response
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFileName}"`,
    },
  });
}