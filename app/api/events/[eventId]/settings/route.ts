import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { title, themeImageUrl } = await req.json();

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { title, themeImageUrl }
  });

  return NextResponse.json(updatedEvent);
}