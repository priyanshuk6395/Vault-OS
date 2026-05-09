import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { passcode } = await req.json();

  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event || event.passcode !== passcode) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Set a secure, HTTP-only cookie that the browser cannot touch via JS
  const cookieStore = await cookies();
  cookieStore.set(`vault_auth_${eventId}`, "authorized", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 4, // 4-hour session
    path: "/",
  });

  return NextResponse.json({ success: true });
}