import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      // Forces the browser to trigger a download dialog
      ResponseContentDisposition: `attachment; filename="bali-memory.jpg"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}