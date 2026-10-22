import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEventAuthorization } from '@/lib/guest-session';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const { event, isOwner } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const people = await prisma.person.findMany({
      where: { eventId },
      include: {
        _count: {
          select: { faceDetections: true } // Shows how many photos they are in
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(people);
  } catch (error) {
    console.error("[EVENT_PEOPLE_ERROR]:", error);
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}