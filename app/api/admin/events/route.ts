import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: Request) {
  try {
    // 1. SESSION & AUTHENTICATION
    // In production, we retrieve the user from the secure server-side session.
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ownerId = session.user.id;

    // 2. DATA ISOLATION & OPTIMIZED QUERY
    // We only select the fields needed for the switcher to minimize payload size.
    const events = await prisma.event.findMany({
      where: { 
        ownerId: ownerId 
      },
      select: { 
        id: true, 
        title: true, 
        passcode: true,
        _count: {
          select: { assets: true } // Bonus: showing asset counts in the switcher
        }
      },
      orderBy: { 
        createdAt: 'desc' 
      }
    });

    // 3. CACHE CONTROL (Benchmark Practice)
    // Prevents browsers from caching sensitive event lists stale-ly
    const response = NextResponse.json(events);
    response.headers.set('Cache-Control', 'no-store, max-age=0');

    return response;

  } catch (error) {
    // 4. ERROR LOGGING & GRACEFUL FAILURES
    console.error("[EVENTS_GET_ERROR]:", error);
    
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to retrieve events." }, 
      { status: 500 }
    );
  }
}