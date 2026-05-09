import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string, detectionId: string }> }
) {
  const { eventId, detectionId } = await params;
  const { action } = await req.json();

  try {
    if (action === 'reject') {
      // 1. REJECT: Hard delete the detection. 
      // It won't show up in search or people galleries.
      await prisma.faceDetection.delete({
        where: { id: detectionId }
      });
      return NextResponse.json({ success: true, message: "Detection discarded" });
    }

    if (action === 'confirm') {
      // 2. IDENTIFY: Move from 'pending' to 'named'
      // This assumes the detection is already linked to a 'Person' record 
      // created during the initial scan.
      const detection = await prisma.faceDetection.findUnique({
        where: { id: detectionId },
        select: { personId: true }
      });

      if (detection?.personId) {
        await prisma.person.update({
          where: { id: detection.personId },
          data: { status: 'named' } // Or keep 'unnamed' until a name is typed
        });
      }
      
      return NextResponse.json({ success: true, message: "Identity confirmed" });
    }

    return NextResponse.json({ success: true }); // Skip does nothing in DB
  } catch (error) {
    console.error("REVIEW_API_ERROR:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}