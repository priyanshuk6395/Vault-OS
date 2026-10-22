"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { issueGuestSessionCookie } from "@/lib/guest-session";
import { migrateLegacyPasscodeIfCurrent, verifyEventPasscode } from "@/lib/passcode";
import { finishPasscodeAttempt, getClientIp, reservePasscodeAttempt } from "@/lib/passcode-attempts";

export async function verifyGuestAccess(eventId: string, passcode: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { passcode: true }
    });
    const headersList = await headers();
    const clientIp = getClientIp(headersList);
    const attemptId = event ? await reservePasscodeAttempt(eventId, clientIp) : null;
    if (event && !attemptId) return { success: false, rateLimited: true };

    if (event && await verifyEventPasscode(passcode, event.passcode)) {
      const passcodeSnapshot = await migrateLegacyPasscodeIfCurrent(eventId, passcode, event.passcode);
      if (!passcodeSnapshot) {
        await finishPasscodeAttempt(eventId, attemptId!, false, clientIp, headersList.get("user-agent") || "Unknown Device");
        return { success: false };
      }
      await finishPasscodeAttempt(eventId, attemptId!, true, clientIp, headersList.get("user-agent") || "Unknown Device");
      // 1. Issue Security Clearance (Cookie)
      await issueGuestSessionCookie(eventId, undefined, passcodeSnapshot);

      // 2. Extract Telemetry Data natively via Next.js Headers
      const userAgent = headersList.get("user-agent") || "Unknown Device";

      // 3. Write Guest Identity to the Audit Trail
      await prisma.accessLog.create({
        data: {
          eventId,
          action: "ACCESS_GRANTED",
          userName: "Guest Participant", // <-- SECURING THE IDENTITY
          ipAddress: clientIp,
          userAgent,
        }
      });

      return { success: true };
    }
    if (event && attemptId) {
      await finishPasscodeAttempt(eventId, attemptId, false, clientIp, headersList.get("user-agent") || "Unknown Device");
    }
    
    return { success: false };
  } catch (error) {
    console.error("[GUEST_AUTH_ERROR]:", error);
    return { success: false };
  }
}