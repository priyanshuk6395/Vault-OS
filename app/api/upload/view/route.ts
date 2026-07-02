import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/aws";

// Same-content-forever cache: a given storageKey never changes, so it's safe to
// let the browser / next/image optimizer / any CDN cache this aggressively.
const CACHE_TTL_SECONDS = 3600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) return new NextResponse("Not Found", { status: 404 });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Stream the object bytes straight through instead of redirecting to a
    // signed S3 URL — next/image's optimizer needs real bytes from a "local"
    // route, not a hop to a different origin.
    const bytes = await s3Response.Body.transformToByteArray();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": s3Response.ContentType || "application/octet-stream",
        "Content-Length": String(s3Response.ContentLength ?? bytes.byteLength),
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, immutable`,
      },
    });
  } catch (error) {
    return new NextResponse("Access Denied", { status: 403 });
  }
}