import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueGuestSessionCookie } from "@/lib/guest-session";
import { isValidEventPasscode, migrateLegacyPasscodeIfCurrent, verifyEventPasscode } from "@/lib/passcode";
import { finishPasscodeAttempt, getClientIp, reservePasscodeAttempt } from "@/lib/passcode-attempts";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { passcode } = await req.json();

  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!isValidEventPasscode(passcode)) {
    return NextResponse.json({ error: "Passcode must be exactly 6 digits." }, { status: 400 });
  }
  if (!event) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const clientIp = getClientIp(req.headers);
  const attemptId = await reservePasscodeAttempt(eventId, clientIp);
  if (!attemptId) {
    return NextResponse.json({ error: "Too many attempts. Please retry in 15 minutes." }, { status: 429 });
  }
  if (!(await verifyEventPasscode(passcode, event.passcode))) {
    await finishPasscodeAttempt(eventId, attemptId, false, clientIp, req.headers.get("user-agent") || "Unknown Device");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const passcodeSnapshot = await migrateLegacyPasscodeIfCurrent(eventId, passcode, event.passcode);
  if (!passcodeSnapshot) {
    await finishPasscodeAttempt(eventId, attemptId, false, clientIp, req.headers.get("user-agent") || "Unknown Device");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await finishPasscodeAttempt(eventId, attemptId, true, clientIp, req.headers.get("user-agent") || "Unknown Device");

  // Set a secure, HTTP-only cookie that the browser cannot touch via JS
  await issueGuestSessionCookie(eventId, 60 * 60 * 4, passcodeSnapshot);

  return NextResponse.json({ success: true });
}