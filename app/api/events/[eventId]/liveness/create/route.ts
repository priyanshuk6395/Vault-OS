import { NextResponse } from "next/server";
import { rekognitionClient } from "@/lib/aws";
import { CreateFaceLivenessSessionCommand } from "@aws-sdk/client-rekognition";

export async function POST() {
  try {
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