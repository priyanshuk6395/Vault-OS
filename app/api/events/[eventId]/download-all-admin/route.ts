import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { Readable, Writable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> } 
) {
  const { eventId } = await params;
  
  // 1. Secure the route (Admin Only)
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized Protocol", { status: 401 });

  // 2. Fetch all assets for this vault
  const assets = await prisma.asset.findMany({
    where: { eventId },
    select: { storageKey: true, sourceFilename: true }
  });

  if (assets.length === 0) return new Response("Vault is empty", { status: 404 });

  // 3. Setup Node-to-Web Stream Bridge
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const archive = archiver("zip", { zlib: { level: 5 } });
  
  const nodeWritable = new Writable({
    write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
      writer.write(chunk).then(() => callback()).catch((err) => callback(err));
    },
    final(callback: (error?: Error | null) => void) {
      writer.close().then(() => callback()).catch((err) => callback(err));
    }
  });

  archive.pipe(nodeWritable);

  // 4. Stream S3 objects directly into the Zip
  (async () => {
    try {
      for (const asset of assets) {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: asset.storageKey,
        });
        const response = await s3Client.send(command);
        const body = response.Body as Readable;
        if (body) archive.append(body, { name: asset.sourceFilename || `${asset.storageKey.split('/').pop()}` });
      }
      await archive.finalize();
    } catch (err) {
      console.error("Archive failure:", err);
      writer.abort(err);
    }
  })();

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Vault_Master_Archive_${eventId.slice(0,8)}.zip"`,
    },
  });
}