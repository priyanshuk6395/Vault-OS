"use server";

import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

export async function verifyGuestAccess(eventId: string, passcode: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { passcode: true }
    });

    if (event && event.passcode === passcode.toUpperCase()) {
      // 1. Issue Security Clearance (Cookie)
      const cookieStore = await cookies();
      cookieStore.set(`event_auth_${eventId}`, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      // 2. Extract Telemetry Data natively via Next.js Headers
      const headersList = await headers();
      const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "127.0.0.1";
      const userAgent = headersList.get("user-agent") || "Unknown Device";

      // 3. Write Guest Identity to the Audit Trail
      await prisma.accessLog.create({
        data: {
          eventId,
          action: "ACCESS_GRANTED",
          userName: "Guest Participant", // <-- SECURING THE IDENTITY
          ipAddress: ip.split(',')[0].trim(),
          userAgent,
        }
      });

      return { success: true };
    }
    
    return { success: false };
  } catch (error) {
    console.error("[GUEST_AUTH_ERROR]:", error);
    return { success: false };
  }
}