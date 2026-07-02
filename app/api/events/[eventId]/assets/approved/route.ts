import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const assets = await prisma.asset.findMany({
    where: { eventId, moderationState: 'approved' },
    select: { id: true, storageKey: true }
  });
  // You would map these to your signed URLs just like in your MediaClientPage
  return NextResponse.json(assets);
}