"use server";

import { prisma } from "@/lib/prisma";
import { issueGuestSessionCookie } from "@/lib/guest-session";
import { migrateLegacyPasscodeIfCurrent, verifyEventPasscode } from "@/lib/passcode";
import { headers } from "next/headers";
import { finishPasscodeAttempt, getClientIp, reservePasscodeAttempt } from "@/lib/passcode-attempts";

export async function verifyPasscode(eventId: string, enteredPasscode: string) {
  const headersList = await headers();
  const clientIp = getClientIp(headersList);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { passcode: true }
  });
  if (!event) return { success: false };
  const attemptId = await reservePasscodeAttempt(eventId, clientIp);
  if (!attemptId) return { success: false, rateLimited: true };

  if (await verifyEventPasscode(enteredPasscode, event.passcode)) {
    const passcodeSnapshot = await migrateLegacyPasscodeIfCurrent(eventId, enteredPasscode, event.passcode);
    if (!passcodeSnapshot) {
      await finishPasscodeAttempt(eventId, attemptId, false, clientIp, headersList.get("user-agent") || "Unknown Device");
      return { success: false };
    }
    await finishPasscodeAttempt(eventId, attemptId, true, clientIp, headersList.get("user-agent") || "Unknown Device");
    // Set a secure, HTTP-only cookie to remember the guest
    await issueGuestSessionCookie(eventId, undefined, passcodeSnapshot);
    return { success: true };
  }

  await finishPasscodeAttempt(eventId, attemptId, false, clientIp, headersList.get("user-agent") || "Unknown Device");

  return { success: false };
}