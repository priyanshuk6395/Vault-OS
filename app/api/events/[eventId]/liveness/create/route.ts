import { NextResponse } from "next/server";
import { rekognitionClient } from "@/lib/aws";
import { CreateFaceLivenessSessionCommand } from "@aws-sdk/client-rekognition";
import { getEventAuthorization } from "@/lib/guest-session";

export async function POST(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { event, isOwner, isGuest } = await getEventAuthorization(eventId);
    if (!event) return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    if (!isOwner && !isGuest) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (isGuest && !event.biometricSearch) {
      return NextResponse.json({ error: "Biometric search is disabled for this vault." }, { status: 403 });
    }
    const response = await rekognitionClient.send(
      new CreateFaceLivenessSessionCommand({})
    );
    // Returns a unique Session ID for the frontend component
    return NextResponse.json({ sessionId: response.SessionId });
  } catch (error) {
    console.error("Liveness Init Error:", error);
    return NextResponse.json({ error: "Failed to initialize liveness session" }, { status: 500 });
  }
}