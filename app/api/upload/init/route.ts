import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { v4 as uuidv4 } from "uuid";

// Local Infrastructure Imports
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/aws";

// AWS SDK Imports
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: Request) {
  try {
    const { 
      eventId, 
      filename, 
      contentType, 
      size, 
      assetType, 
      uploaderId 
    } = await req.json();

    // 1. DUAL-PROTOCOL SECURITY GATE
    const cookieStore = await cookies();
    const hasGuestAccess = cookieStore.get(`event_auth_${eventId}`);
    
    const session = await getServerSession(authOptions);
    const isAdmin = !!session?.user;

    if (!hasGuestAccess && !isAdmin) {
      return NextResponse.json(
        { error: "Access Denied: Protocol passcode or Admin session required." }, 
        { status: 401 }
      );
    }

    // 2. PAYLOAD VALIDATION
    const MAX_FILE_SIZE = 50 * 1024 * 1024; 
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Payload exceeds 50MB limit." }, { status: 413 });
    }

    // 3. DATABASE: INITIALIZE ASSET RECORD
    const assetId = uuidv4();
    const fileExtension = filename.split('.').pop() || 'jpg';
    
    const folderName = isAdmin ? "approved" : "pending";
    const s3Key = `events/${eventId}/${folderName}/${assetId}.${fileExtension}`;

    // TACTICAL LOGIC: 
    // If admin, we bypass moderation (approved) and bypass analysis (processed)
    // because admin-uploaded content is trusted.
    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        eventId: eventId,
        sourceFilename: filename,
        storageKey: s3Key,
        assetType: assetType || "image",
        
        // AUTO-MODERATION FOR ADMINS
        status: isAdmin ? "processed" : "uploaded",
        moderationState: isAdmin ? "approved" : "pending",
        
        // IDENTITY ASSOCIATION
        uploaderId: isAdmin ? (session?.user as any)?.id : (uploaderId || null),
      },
    });

    // 4. AWS HANDSHAKE: GENERATE PRESIGNED URL
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
    console.error(" [SYSTEM_FAILURE] UPLOAD_INIT_PIPELINE:", error);
    return NextResponse.json(
      { error: "Infrastructure Handshake Failed" }, 
      { status: 500 }
    );
  }
}