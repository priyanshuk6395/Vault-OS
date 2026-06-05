import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { passcode, eventId } = await req.json();

    // 1. Locate the Vault
    const event = await prisma.event.findFirst({
      where: {
        ...(eventId ? { id: eventId, passcode } : { passcode })
      }
    });

    if (!event) {
      // Optional: You could log "ACCESS_DENIED" here to track brute-force attempts
      return NextResponse.json({ error: "Invalid protocol passcode." }, { status: 401 });
    }

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
    const cookieStore = await cookies();
    cookieStore.set(`event_auth_${event.id}`, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7 // 7-day clearance
    });

    return NextResponse.json({ success: true, eventId: event.id });
    
  } catch (error: any) {
    console.error("[SECURITY_LOG_ERROR]:", error);
    return NextResponse.json(
      { error: "System verification failed." }, 
      { status: 500 }
    );
  }
}