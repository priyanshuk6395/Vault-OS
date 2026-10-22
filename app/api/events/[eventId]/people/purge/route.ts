import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEventAuthorization } from '@/lib/guest-session';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
    const { event, isOwner } = await getEventAuthorization(eventId);
    if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Find all people in this event who have ZERO face detections
    const deleted = await prisma.person.deleteMany({
      where: {
        eventId,
        faceDetections: {
          none: {} // This is the "Magic" Prisma filter for orphans
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: deleted.count,
      message: `Successfully purged ${deleted.count} orphan identities.` 
    });
  } catch (error) {
    console.error("PURGE_ERROR:", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}