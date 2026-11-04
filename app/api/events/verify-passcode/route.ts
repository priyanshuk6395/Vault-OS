import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueGuestSessionCookie } from "@/lib/guest-session";
import { isValidEventPasscode, migrateLegacyPasscodeIfCurrent, verifyEventPasscode } from "@/lib/passcode";
import { finishPasscodeAttempt, getClientIp, reservePasscodeAttempt } from "@/lib/passcode-attempts";

export async function POST(req: Request) {
  try {
    const { passcode, eventId } = await req.json();
    if (!isValidEventPasscode(passcode) || typeof eventId !== "string" || !eventId) {
      return NextResponse.json({ error: "Invalid passcode request." }, { status: 400 });
    }

    // 1. Locate the Vault
    const candidate = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, passcode: true },
    });
    if (!candidate) return NextResponse.json({ error: "Invalid protocol passcode." }, { status: 401 });
    const clientIp = getClientIp(req.headers);
    const attemptId = await reservePasscodeAttempt(eventId, clientIp);
    if (!attemptId) {
      return NextResponse.json({ error: "Too many attempts. Please retry in 15 minutes." }, { status: 429 });
    }
    const event = await verifyEventPasscode(passcode, candidate.passcode) ? candidate : null;

    if (!event) {
      // Optional: You could log "ACCESS_DENIED" here to track brute-force attempts
      await finishPasscodeAttempt(eventId, attemptId, false, clientIp, req.headers.get("user-agent") || "Unknown Device");
      return NextResponse.json({ error: "Invalid protocol passcode." }, { status: 401 });
    }
    const passcodeSnapshot = await migrateLegacyPasscodeIfCurrent(event.id, passcode, event.passcode);
    if (!passcodeSnapshot) {
      await finishPasscodeAttempt(event.id, attemptId, false, clientIp, req.headers.get("user-agent") || "Unknown Device");
      return NextResponse.json({ error: "Invalid protocol passcode." }, { status: 401 });
    }
    await finishPasscodeAttempt(event.id, attemptId, true, clientIp, req.headers.get("user-agent") || "Unknown Device");

    // 2. Extract Telemetry Data
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "Unknown Origin";
    const userAgent = req.headers.get("user-agent") || "Unknown Device";

    // 3. Write to Audit Trail
    await prisma.accessLog.create({
      data: {
        eventId: event.id,
        action: "ACCESS_GRANTED",
        userName: "Guest Participant",
        ipAddress: ip.split(',')[0], // Clean up if multiple IPs are forwarded
        userAgent: userAgent,
      }
    });

    // 4. Issue Security Clearance (Cookie)
    await issueGuestSessionCookie(event.id, 60 * 60 * 24 * 7, passcodeSnapshot);

    return NextResponse.json({ success: true, eventId: event.id });
    
  } catch (error: unknown) {
    console.error("[SECURITY_LOG_ERROR]:", error);
    return NextResponse.json(
      { error: "System verification failed." }, 
      { status: 500 }
    );
  }
}