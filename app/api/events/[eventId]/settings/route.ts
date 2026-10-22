import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventAuthorization } from "@/lib/guest-session";

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, isOwner } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { title, themeImageUrl } = body;
  if ((title !== undefined && (typeof title !== "string" || !title.trim())) ||
      (themeImageUrl !== undefined && typeof themeImageUrl !== "string")) {
    return NextResponse.json({ error: "Invalid event settings." }, { status: 400 });
  }
  if (themeImageUrl) {
    const selectedAsset = await prisma.asset.findFirst({
      where: { eventId, storageKey: themeImageUrl, moderationState: "approved" },
      select: { id: true },
    });
    if (!selectedAsset) return NextResponse.json({ error: "Theme image must be an approved asset in this vault." }, { status: 400 });
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { ...(title !== undefined ? { title: title.trim() } : {}), ...(themeImageUrl !== undefined ? { themeImageUrl: themeImageUrl || null } : {}) }
  });

  return NextResponse.json(updatedEvent);
}