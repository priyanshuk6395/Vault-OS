import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth'; // Adjust based on your auth setup

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    // 1. SECURITY CATCH
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized Node Access' }, { status: 401 });
    }

    const { personId } = await params;
    const { name, status } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Identity protocol requires a valid name.' }, { status: 400 });
    }

    const normalizedName = name.trim();

    // 2. CONTEXTUAL LOOKUP
    // We need to know which vault this person belongs to before we check for duplicates
    const currentPerson = await prisma.person.findUnique({
      where: { id: personId },
      select: { eventId: true }
    });

    if (!currentPerson) {
      return NextResponse.json({ error: 'Entity not found in the index.' }, { status: 404 });
    }

    // 3. THE COLLISION CHECK
    // Does someone with this exact name already exist in THIS specific vault?
    const existingIdentity = await prisma.person.findFirst({
      where: {
        eventId: currentPerson.eventId,
        name: { equals: normalizedName, mode: 'insensitive' }, // "rahul" matches "Rahul"
        id: { not: personId } // Exclude the person we are currently editing
      }
    });

    // 4. THE AUTO-MERGE ENGINE
    if (existingIdentity) {
      // Execute a transactional merge so data is never left in a corrupted state
      await prisma.$transaction([
        // Step A: Re-assign all facial bounding boxes to the primary identity
        prisma.faceDetection.updateMany({
          where: { personId },
          data: { personId: existingIdentity.id }
        }),
        // Step B: Re-assign all ML training samples to the primary identity
        prisma.faceSample.updateMany({
          where: { personId },
          data: { personId: existingIdentity.id }
        }),
        // Step C: Terminate the duplicate cluster
        prisma.person.delete({
          where: { id: personId }
        })
      ]);

      // Return the merged identity to the client
      return NextResponse.json({ 
        ...existingIdentity, 
        mergedInto: existingIdentity.id,
        message: "Clusters merged successfully" 
      });
    }

    // 5. STANDARD RESOLUTION (No Collision)
    const updatedPerson = await prisma.person.update({
      where: { id: personId },
      data: { 
        name: normalizedName,
        status: status || 'named',
      },
    });

    return NextResponse.json(updatedPerson);

  } catch (error) {
    console.error("Identity Resolution Error:", error);
    return NextResponse.json({ error: 'Failed to process identity protocol.' }, { status: 500 });
  }
}