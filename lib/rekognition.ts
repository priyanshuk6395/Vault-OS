import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  ListCollectionsCommand,
  ListFacesCommand,
} from "@aws-sdk/client-rekognition";
import { rekognitionClient } from "./aws";

/**
 * Initializes a unique face collection for an event.
 * In Rekognition, Collections are the containers for face vectors.
 */
export async function initializeEventCollection(eventId: string) {
  const collectionId = `event-${eventId}`;

  try {
    // 1. Check if collection already exists
    const list = await rekognitionClient.send(new ListCollectionsCommand({}));
    if (list.CollectionIds?.includes(collectionId)) {
      return { success: true, message: "Collection already exists" };
    }

    // 2. Create the unique event-scoped collection
    await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    
    return { success: true, collectionId };
  } catch (error) {
    console.error("Rekognition Setup Error:", error);
    throw new Error("Failed to initialize face collection for event");
  }
}

export async function deleteEventFacesForImage(eventId: string, externalImageIds: string | string[]) {
  const collectionId = `event-${eventId}`;
  const imageIds = new Set(Array.isArray(externalImageIds) ? externalImageIds : [externalImageIds]);
  const faceIds: string[] = [];
  let nextToken: string | undefined;

  do {
    let page;
    try {
      page = await rekognitionClient.send(new ListFacesCommand({
        CollectionId: collectionId,
        MaxResults: 1000,
        NextToken: nextToken,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "ResourceNotFoundException") return;
      throw error;
    }
    faceIds.push(...(page.Faces ?? [])
      .filter((face) => !!face.ExternalImageId && imageIds.has(face.ExternalImageId) && typeof face.FaceId === "string")
      .map((face) => face.FaceId!));
    nextToken = page.NextToken;
  } while (nextToken);

  await deleteEventFaceIds(eventId, faceIds);
}

export async function deleteEventFaceIds(eventId: string, faceIds: string[]) {
  const collectionId = `event-${eventId}`;
  for (let offset = 0; offset < faceIds.length; offset += 4000) {
    const response = await rekognitionClient.send(new DeleteFacesCommand({
      CollectionId: collectionId,
      FaceIds: faceIds.slice(offset, offset + 4000),
    }));
    if (response.UnsuccessfulFaceDeletions?.length) {
      throw new Error(`Failed to delete ${response.UnsuccessfulFaceDeletions.length} Rekognition face vectors.`);
    }
  }
}