"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function verifyPasscode(eventId: string, enteredPasscode: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { passcode: true }
  });

  if (event && event.passcode === enteredPasscode.toUpperCase()) {
    // Set a secure, HTTP-only cookie to remember the guest
    const cookieStore = await cookies();
    cookieStore.set(`event_auth_${eventId}`, "true", { 
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_NODE === "production"
    });
    return { success: true };
  }

  return { success: false };
}