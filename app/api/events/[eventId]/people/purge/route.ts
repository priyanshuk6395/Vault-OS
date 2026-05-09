import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  try {
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