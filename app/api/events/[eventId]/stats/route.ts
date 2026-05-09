import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> } // Standard Next.js 16 async params
) {
  const { eventId } = await params;

  try {
    // 1. Fetching Metadata and Stats in parallel for performance
    const [event, totalAssets, imageCount, videoCount, unnamedPeople] = await Promise.all([
      // Fetch the Title and potentially other meta info
      prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true }
      }),
      prisma.asset.count({ where: { eventId } }),
      prisma.asset.count({ where: { eventId, assetType: 'image' } }),
      prisma.asset.count({ where: { eventId, assetType: 'video' } }),
      prisma.person.count({ 
        where: { 
          eventId, 
          // Adjusting to match common schema logic: status 'unnamed' or empty name
          OR: [
            { status: 'unnamed' },
            { name: null },
            { name: "" }
          ]
        } 
      }),
    ]);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      title: event.title, // Now returned to your client component
      totalAssets,
      imageCount,
      videoCount,
      unnamedPeople,
    });
  } catch (error) {
    console.error("[STATS_API_ERROR]:", error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}