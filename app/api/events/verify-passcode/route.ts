import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { passcode } = await req.json();
  const event = await prisma.event.findUnique({ where: { passcode } });

  if (!event) return NextResponse.json({ error: "Invalid Passcode" }, { status: 401 });

  // In a benchmark system, we'd set a JWT/Cookie here
  return NextResponse.json({ eventId: event.id, eventName: event.title });
}