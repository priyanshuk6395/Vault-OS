import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initializeEventCollection } from "@/lib/rekognition";
import { encryptEventPasscode, isValidEventPasscode } from "@/lib/passcode";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name, passcode } = await req.json();
    if (typeof name !== "string" || !name.trim() || !isValidEventPasscode(passcode)) {
      return NextResponse.json({ error: "A title and a six-digit numeric passcode are required." }, { status: 400 });
    }
    const ownerId = session.user.id;

    // 1. Create the Event in Prisma
    const newEvent = await prisma.event.create({
      data: {
        title:name,
        passcode: encryptEventPasscode(passcode),
        ownerId,
      }
    });

    // 2. Initialize Biometric Isolation (AWS Benchmark)
    // Every event gets its own dedicated Rekognition Collection
    try {
      await initializeEventCollection(newEvent.id);
    } catch (rekogError) {
      console.error("AWS Collection creation failed:", rekogError);
      // We keep the event but log the error for manual retry
    }

    return NextResponse.json({
      id: newEvent.id,
      title: newEvent.title,
      ownerId: newEvent.ownerId,
      guestUploadPolicy: newEvent.guestUploadPolicy,
      createdAt: newEvent.createdAt,
      themeImageUrl: newEvent.themeImageUrl,
    });
  } catch (error) {
    console.log(error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}