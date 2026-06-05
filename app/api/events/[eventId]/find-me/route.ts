import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GetFaceLivenessSessionResultsCommand, SearchFacesByImageCommand } from '@aws-sdk/client-rekognition';
import { rekognitionClient } from '@/lib/aws';

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { sessionId } = await req.json();

    // 1. GET LIVENESS RESULTS FROM AWS
    const livenessResult = await rekognitionClient.send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId })
    );

    // 🛠️ TEMPORARY FIX: Dropped threshold to 50 for testing
    if (livenessResult.Status !== "SUCCEEDED" || (livenessResult.Confidence || 0) < 67) {
      
      // Write the hacker to the immutable audit trail
      await prisma.accessLog.create({
        data: {
          eventId,
          action: "SPOOF_ATTEMPT_BLOCKED",
          userName: `Blocked (Score: ${livenessResult.Confidence})`, // Logs the score in the DB too!
          ipAddress: req.headers.get("x-forwarded-for")?.split(',')[0].trim() || "127.0.0.1",
          userAgent: req.headers.get("user-agent") || "Malicious Client",
        }
      });
      return NextResponse.json({ error: "SECURITY BREACH: Non-human entity detected." }, { status: 403 });
    }

    // 2. EXTRACT THE VERIFIED REFERENCE IMAGE
    const imageBytes = livenessResult.ReferenceImage?.Bytes;
    if (!imageBytes) {
      return NextResponse.json({ error: "Failed to capture reference image." }, { status: 400 });
    }

    // 3. SEARCH VAULT COLLECTION WITH THE VERIFIED IMAGE
    const searchResponse = await rekognitionClient.send(new SearchFacesByImageCommand({
      CollectionId: `event-${eventId}`,
      Image: { Bytes: imageBytes },
      FaceMatchThreshold: 90,
      MaxFaces: 1,
    }));

    if (!searchResponse.FaceMatches?.length) {
      return NextResponse.json({ error: "No matching face found in the vault." }, { status: 404 });
    }

    const matchedFaceId = searchResponse.FaceMatches[0].Face?.FaceId;

    // 4. IDENTIFY THE PERSON
    const detection = await prisma.faceDetection.findUnique({
      where: { faceId: matchedFaceId },
      include: { person: true }
    });

    if (!detection) return NextResponse.json({ error: "Identity found in AWS but not in DB." }, { status: 404 });

    // 5. FETCH THEIR ASSETS
    const myPhotos = await prisma.asset.findMany({
      where: {
        eventId, 
        faceDetections: { some: { personId: detection.personId } },
        status: 'processed',         
        moderationState: 'approved'
      },
      orderBy: { createdAt: 'desc' }
    });

    // 6. LOG SUCCESS IN TELEMETRY
    await prisma.accessLog.create({
      data: {
        eventId,
        action: "BIOMETRIC_VERIFIED",
        userName: detection.person.name || "Unnamed Guest",
        ipAddress: req.headers.get("x-forwarded-for")?.split(',')[0].trim() || "127.0.0.1",
        userAgent: req.headers.get("user-agent") || "Mobile Client",
      }
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