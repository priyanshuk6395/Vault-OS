import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SearchFacesByImageCommand } from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '@/lib/aws';

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { imageBase64 } = await req.json();

    // 1. PRIVACY CHECK (Benchmark Practice)
    // We fetch the event settings first to see if Biometric Search is allowed.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { biometricSearch: true, title: true }
    });

    if (!event) {
      return NextResponse.json({ error: "Event vault not found." }, { status: 404 });
    }

    // If the admin turned off biometric search, we block the request immediately.
    if (!event.biometricSearch) {
      return NextResponse.json({ 
        error: "Biometric search is currently disabled for this event by the administrator." 
      }, { status: 403 });
    }

    // 2. SEARCH REKOGNITION COLLECTION
    const searchResponse = await rekognitionClient.send(new SearchFacesByImageCommand({
      CollectionId: `event-${eventId}`,
      Image: { Bytes: Buffer.from(imageBase64.split(",")[1], 'base64') },
      FaceMatchThreshold: 90,
      MaxFaces: 1,
    }));

    if (!searchResponse.FaceMatches?.length) {
      return NextResponse.json({ 
        error: "No matching face found in the vault. Try a different angle?" 
      }, { status: 404 });
    }

    const matchedFaceId = searchResponse.FaceMatches[0].Face?.FaceId;

    // 3. IDENTIFY PERSON
    const detection = await prisma.faceDetection.findUnique({
      where: { faceId: matchedFaceId },
      include: { person: true }
    });

    if (!detection) {
      return NextResponse.json({ error: "Identity found in AWS but not in database." }, { status: 404 });
    }

    // 4. SCOPED ASSET FETCH
    const myPhotos = await prisma.asset.findMany({
      where: {
        eventId, 
        faceDetections: { some: { personId: detection.personId } },
        status: 'processed',         
        moderationState: 'approved'
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
      personName: detection.person.name,
      personId: detection.personId,
      photos: myPhotos 
    });

  } catch (error) {
    console.error("[BIOMETRIC_SEARCH_ERROR]:", error);
    return NextResponse.json({ error: "Biometric verification failed" }, { status: 500 });
  }
}