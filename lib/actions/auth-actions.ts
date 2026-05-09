"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function verifyGuestAccess(eventId: string, passcode: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { passcode: true }
    });

    if (event && event.passcode === passcode) {
      const cookieStore = await cookies();
      cookieStore.set(`event_auth_${eventId}`, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    return { success: false };
  }
}