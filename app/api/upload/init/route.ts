import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const { eventId, filename, contentType, size, assetType, uploaderId } = await req.json();

    // 1. SECURITY GATE: Verify Guest Permission
    const cookieStore = await cookies();
    const hasAccess = cookieStore.get(`event_auth_${eventId}`);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access Denied: Protocol passcode required." }, 
        { status: 401 }
      );
    }

    // 2. VALIDATION: Check file constraints
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }

    // 3. DATABASE: Create "Pending" Asset Record
    const assetId = uuidv4();
    const fileExtension = filename.split('.').pop();
    // Path includes 'pending' to keep S3 organized
    const s3Key = `events/${eventId}/pending/${assetId}.${fileExtension}`;

    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        eventId: eventId,
        sourceFilename: filename,
        storageKey: s3Key,
        assetType: assetType, // 'image' or 'video'
        status: "uploaded",    // Matches your schema @default
        moderationState: "pending",
        uploaderId: uploaderId || null,
      },
    });

    // 4. AWS HANDSHAKE: Generate Presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return NextResponse.json({ 
      uploadUrl, 
      assetId: asset.id 
    });

  } catch (error: any) {
    console.error("UPLOAD_INIT_ERROR:", error);
    return NextResponse.json(
      { error: "Infrastructure Handshake Failed" }, 
      { status: 500 }
    );
  }
}