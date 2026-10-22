import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventAuthorization, getGuestPersonId } from "@/lib/guest-session";

const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { assetId, uploaderId } = await req.json();
    if (typeof assetId !== "string" || !assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    const { event, isOwner, isGuest } = await getEventAuthorization(asset.eventId);
    if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isOwner && (
      asset.moderationState !== "pending" ||
      asset.uploaderId !== uploaderId ||
      typeof uploaderId !== "string" ||
      await getGuestPersonId(asset.eventId) !== uploaderId
    )) {
      return NextResponse.json({ error: "Upload is not authorized for this guest." }, { status: 403 });
    }

    await prisma.asset.updateMany({
      where: {
        id: assetId,
        OR: [
          { status: { in: ["uploading", "uploaded"] } },
          { status: "processing", jobStartedAt: { lt: new Date(Date.now() - PROCESSING_STALE_AFTER_MS) } },
        ],
      },
      data: { status: "failed", errorMessage: "Client upload or processing failed." },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UPLOAD_FAILURE_REPORT_ERROR]:", error);
    return NextResponse.json({ error: "Failed to record upload failure." }, { status: 500 });
  }
}