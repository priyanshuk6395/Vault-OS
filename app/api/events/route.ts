import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initializeEventCollection } from '@/lib/rekognition';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/lib/auth";
import { encryptEventPasscode } from "@/lib/passcode";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { title, passcode, guestUploadPolicy } = await req.json();

    if (!title || !passcode) {
      return NextResponse.json({ error: 'Title and passcode are required' }, { status: 400 });
    }
    if (typeof title !== "string" || typeof passcode !== "string" || passcode.trim().length < 4) {
      return NextResponse.json({ error: 'Title and a passcode of at least 4 characters are required.' }, { status: 400 });
    }

    // 1. Create the Event in PostgreSQL
    const event = await prisma.event.create({
      data: {
        id: uuidv4(),
        title,
        passcode: encryptEventPasscode(passcode),
        guestUploadPolicy: guestUploadPolicy || 'allowed',
        ownerId: session.user.id,
      },
    });

    // 2. Initialize the Rekognition Collection
    // This creates a private biometric sandbox for just this event
    try {
      await initializeEventCollection(event.id);
    } catch (aiError) {
      console.error("AI Initialization failed, but event was created:", aiError);
      // We return the event anyway, but with a warning or background retry flag
    }

    return NextResponse.json({
      id: event.id,
      title: event.title,
      ownerId: event.ownerId,
      guestUploadPolicy: event.guestUploadPolicy,
      createdAt: event.createdAt,
      themeImageUrl: event.themeImageUrl,
    }, { status: 201 });
  } catch (error) {
    console.error("Event Creation Error:", error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}