import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "Missing Target" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "System Admin Node";
    
    // Extract Name or Email, fallback to System Admin
    const adminIdentity = session.user?.name || session.user?.email || "System Admin";

    await prisma.accessLog.create({
      data: {
        eventId,
        action: "ADMIN_ACCESS",
        userName: adminIdentity, // <-- LOGGING IDENTITY
        ipAddress: ip.split(',')[0],
        userAgent,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Telemetry Failure" }, { status: 500 });
  }
}