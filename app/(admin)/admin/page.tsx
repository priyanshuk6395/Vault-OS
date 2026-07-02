import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import DashboardGreeting from "@/components/admin/DashboardGreeting";

export default async function AdminDashboard() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const events = await prisma.event.findMany({
    include: {
      _count: { select: { assets: true, persons: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // For each event, find the guest with the most appearances (max faceDetections)
  // and grab their clearest shot to use as the card's cover avatar.
  const eventsWithTopPerson = await Promise.all(
    events.map(async (event) => {
      const topPerson = await prisma.person.findFirst({
        where: { eventId: event.id },
        orderBy: { faceDetections: { _count: "desc" } },
        include: {
          faceDetections: {
            take: 1,
            orderBy: { confidence: "desc" },
            include: { asset: true }
          },
          _count: { select: { faceDetections: true } }
        }
      });

      const bestFace = topPerson?.faceDetections[0];
      // Skip if the top person has zero detections (shouldn't happen, but be safe)
      if (!bestFace || topPerson._count.faceDetections === 0) {
        return { ...event, topPersonImageKey: null };
      }

      return { ...event, topPersonImageKey: bestFace.asset.storageKey };
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <DashboardGreeting userName={session.user?.name || "Admin"} />
      <AdminDashboardClient events={eventsWithTopPerson} />
    </div>
  );
}