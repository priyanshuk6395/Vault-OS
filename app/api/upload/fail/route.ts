import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventAuthorization, getGuestPersonId } from "@/lib/guest-session";

const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;
const FAILURE_STAGES = ["preparing", "initializing", "s3-put", "finalizing"] as const;

export async function POST(req: Request) {
  try {
    const { assetId, uploaderId, failureStage, errorMessage } = await req.json();
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

    const stage = FAILURE_STAGES.includes(failureStage) ? failureStage : "unknown";
    const safeDetail = typeof errorMessage === "string"
      ? errorMessage
          .replace(/https?:\/\/\S+/gi, "[url]")
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 240)
      : "";
    const failureDescription = safeDetail || "Client upload or processing failed.";

    await prisma.asset.updateMany({
      where: {
        id: assetId,
        OR: [
          { status: { in: ["uploading", "uploaded"] } },
          { status: "processing", jobStartedAt: { lt: new Date(Date.now() - PROCESSING_STALE_AFTER_MS) } },
        ],
      },
      data: { status: "failed", errorMessage: `CLIENT_FAILURE[${stage}]: ${failureDescription}` },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UPLOAD_FAILURE_REPORT_ERROR]:", error);
    return NextResponse.json({ error: "Failed to record upload failure." }, { status: 500 });
  }
}