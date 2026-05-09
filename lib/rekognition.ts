import { CreateCollectionCommand, ListCollectionsCommand } from "@aws-sdk/client-rekognition";
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