import { 
  GetFaceDetectionCommand, 
  SearchFacesByImageCommand 
} from "@aws-sdk/client-rekognition";
import { rekognitionClient } from "./aws";
import { prisma } from "./prisma";

export async function processBiometricResults(assetId: string, jobId: string) {
  try {
    // 1. Fetch the raw detections from AWS
    const awsData = await rekognitionClient.send(new GetFaceDetectionCommand({ 
      JobId: jobId 
    }));

    if (!awsData.Faces) return;

    // 2. Get Event Context (Needed for Collection ID)
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { eventId: true, storageKey: true }
    });
    if (!asset) return;

    const collectionId = `event-${asset.eventId}`;

    // 3. Process each unique face found in the video
    // AWS returns faces at timestamps; we group by Face ID to avoid duplicates
    const uniqueFaces = new Map();
    awsData.Faces.forEach(f => {
       if (f.Face && !uniqueFaces.has((f.Face as any).ExternalImageId)) {
         uniqueFaces.set((f.Face as any).ExternalImageId, f.Face);
       }
    });

    for (const face of uniqueFaces.values()) {
      // Identity Resolution: Search collection for existing matches
      const searchResponse = await rekognitionClient.send(new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { S3Object: { Bucket: process.env.AWS_S3_BUCKET, Name: asset.storageKey } },
        FaceMatchThreshold: 90,
      }));

      let personId: string | null = null;
      const matches = searchResponse.FaceMatches || [];

      if (matches.length > 0) {
        // Find existing person in DB from the matches
        const matchIds = matches.map(m => m.Face?.FaceId).filter(Boolean) as string[];
        const existingPerson = await prisma.faceDetection.findFirst({
          where: { faceId: { in: matchIds } },
          select: { personId: true }
        });
        personId = existingPerson?.personId || null;
      }

      // If no match, create a new "Unnamed" identity
      if (!personId) {
        const newPerson = await prisma.person.create({
          data: { eventId: asset.eventId, status: 'unnamed' }
        });
        personId = newPerson.id;
      }

      // 4. Persistence: Link the face to the asset and person
      await prisma.faceDetection.upsert({
        where: { faceId: face.FaceId },
        update: { assetId, personId },
        create: {
          id: face.FaceId,
          faceId: face.FaceId,
          assetId,
          personId,
          confidence: face.Confidence || 0,
          boundingBox: face.BoundingBox as any,
        }
      });
    }
  } catch (error) {
    console.error("[BIOMETRIC_INGESTION_ERROR]:", error);
    throw error;
  }
}