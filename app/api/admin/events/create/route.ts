import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateCollectionCommand } from "@aws-sdk/client-rekognition";
import { rekognitionClient } from "@/lib/aws";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
    const { name, passcode } = await req.json();
    const ownerId = "priyanshuk6395";

    // 1. Create the Event in Prisma
    const newEvent = await prisma.event.create({
      data: {
        title:name,
        passcode,
        ownerId,
      }
    });

    // 2. Initialize Biometric Isolation (AWS Benchmark)
    // Every event gets its own dedicated Rekognition Collection
    try {
      await rekognitionClient.send(
        new CreateCollectionCommand({ CollectionId: newEvent.id })
      );
    } catch (rekogError) {
      console.error("AWS Collection creation failed:", rekogError);
      // We keep the event but log the error for manual retry
    }

    return NextResponse.json(newEvent);
  } catch (error) {
    console.log(error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}