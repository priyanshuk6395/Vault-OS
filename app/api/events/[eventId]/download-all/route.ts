import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { Readable, Writable } from "stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> } 
){
  const { eventId } = await params;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");

  if (!personId) return new Response("Unauthorized", { status: 401 });

  // 1. Resolve all matches for this guest
  const assets = await prisma.asset.findMany({
    where: {
      eventId,
      faceDetections: { some: { personId } },
      status: 'processed',
      moderationState: 'approved'
    },
    select: { storageKey: true, sourceFilename: true }
  });

  if (assets.length === 0) return new Response("No assets found", { status: 404 });

  // 2. Setup the Stream Channel
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Archiver needs a Node.js Writable, so we bridge it
  const archive = archiver("zip", { zlib: { level: 5 } });
  
  // Bridge Node stream to Web stream
  const nodeWritable = new Writable({
  write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
    writer.write(chunk)
      .then(() => callback())
      .catch((err) => callback(err));
  },
  final(callback: (error?: Error | null) => void) {
    writer.close()
      .then(() => callback())
      .catch((err) => callback(err));
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
          archive.append(body, { name: asset.sourceFilename || `${asset.storageKey}.jpg` });
        }
      }
      await archive.finalize();
    } catch (err) {
      console.error("Zipping error:", err);
      writer.abort(err);
    }
  })();

  // 4. Return cinematic stream response
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Vault_Archive_${eventId}.zip"`,
    },
  });
}