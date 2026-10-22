import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { prisma } from "@/lib/prisma";
import { getEventAuthorization, getGuestPersonId, guestCanAccessAsset } from "@/lib/guest-session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const rawFilename = searchParams.get("filename");

  if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

  const asset = await prisma.asset.findFirst({
    where: { storageKey: key },
    select: { id: true, eventId: true, status: true, moderationState: true },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  const { event, isOwner, isGuest } = await getEventAuthorization(asset.eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner) {
    const personId = event.publicGallery || !event.biometricSearch ? null : await getGuestPersonId(asset.eventId);
    const hasPersonalAccess = await guestCanAccessAsset(asset.eventId, personId, asset.id);
    const isApprovedProcessed = asset.moderationState === "approved" && asset.status === "processed";
    if (!isGuest || (event.publicGallery ? !isApprovedProcessed : !hasPersonalAccess)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 1. Fallback logic: Use the provided name, or extract from the S3 key
  let downloadName = rawFilename || key.split('/').pop() || 'vault_asset';

  // 2. Sanitize for HTTP Headers (Browsers reject filenames with quotes or newlines)
  downloadName = downloadName.replace(/["\n\r]/g, '_');

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      // 3. The magic header: Forces a download AND strictly sets the filename
      ResponseContentDisposition: `attachment; filename="${downloadName}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    const response = NextResponse.json({ url });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("[S3_PRESIGN_ERROR]:", error);
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}