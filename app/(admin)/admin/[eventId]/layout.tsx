import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, ownsEvent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!event || !ownsEvent(event.ownerId, session.user.id)) notFound();

  return children;
}