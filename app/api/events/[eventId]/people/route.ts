import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

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
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}