import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEventAuthorization } from '@/lib/guest-session';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> } // Standard Next.js 16 async params
) {
  const { eventId } = await params;
  const { event, isOwner } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Fetching Metadata and Stats in parallel for performance
    const [totalAssets, imageCount, videoCount, unnamedPeople] = await Promise.all([
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