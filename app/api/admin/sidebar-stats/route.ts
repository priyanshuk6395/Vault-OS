import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventAuthorization } from "@/lib/guest-session";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) return NextResponse.json({ error: "Missing Event ID" }, { status: 400 });
  const { event, isOwner } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalAssets, totalPeople, faceReviewCount] = await Promise.all([
    prisma.asset.count({ where: { eventId } }),
    prisma.person.count({ where: { eventId } }),
    // Count faces that have low confidence or require manual merging
    prisma.faceDetection.count({ 
      where: { 
        asset: { eventId },
        confidence: { lt: 90 } 
      } 
    }),
  ]);

  return NextResponse.json({
    totalAssets,
    totalPeople,
    faceReviewCount,
    guestUploadsCount: 0, // Logic for pending approvals can be added here
  });
}