import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEventAuthorization } from '@/lib/guest-session';
import { deleteEventFaceIds } from '@/lib/rekognition';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string, detectionId: string }> }
) {
  const { eventId, detectionId } = await params;
  const { event, isOwner } = await getEventAuthorization(eventId);
  if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  if (!isOwner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await req.json();

  try {
    const detection = await prisma.faceDetection.findFirst({
      where: { id: detectionId, asset: { eventId } },
      select: { id: true, personId: true, faceId: true },
    });
    if (!detection) return NextResponse.json({ error: "Detection not found" }, { status: 404 });
    if (action === 'reject') {
      await deleteEventFaceIds(eventId, [detection.faceId]);
      // 1. REJECT: Hard delete the detection. 
      // It won't show up in search or people galleries.
      await prisma.faceDetection.delete({ where: { id: detection.id } });
      return NextResponse.json({ success: true, message: "Detection discarded" });
    }

    if (action === 'confirm') {
      // 2. IDENTIFY: Move from 'pending' to 'named'
      // This assumes the detection is already linked to a 'Person' record 
      // created during the initial scan.
      if (detection.personId) {
        await prisma.person.updateMany({
          where: { id: detection.personId, eventId },
          data: { status: 'named' } // Or keep 'unnamed' until a name is typed
        });
      }
      
      return NextResponse.json({ success: true, message: "Identity confirmed" });
    }

    if (action === 'skip') return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Unsupported review action." }, { status: 400 });
  } catch (error) {
    console.error("REVIEW_API_ERROR:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}