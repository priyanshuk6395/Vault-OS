import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getEventAuthorization } from "@/lib/guest-session";

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, isOwner, isGuest } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isGuest && !event.publicGallery) {
    return NextResponse.json({ error: "Public gallery is disabled for this vault." }, { status: 403 });
  }

  const assets = await prisma.asset.findMany({
    where: { eventId, moderationState: 'approved', status: "processed" },
    select: { id: true, storageKey: true }
  });
  const response = NextResponse.json(assets);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}