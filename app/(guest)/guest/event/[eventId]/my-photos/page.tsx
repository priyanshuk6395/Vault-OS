import { prisma } from "@/lib/prisma";
import GuestUploadTrigger from "@/components/guest/GuestUploadTrigger";
import GuestGalleryClient from "@/components/guest/GuestGalleryClient";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck, Activity, Lock, Cpu } from "lucide-react";
import LogoutButton from "@/components/guest/LogoutButton";

export default async function MyPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ personId: string }>;
}) {
  const { eventId } = await params;
  const { personId } = await searchParams;

  // 1. SECURE AUTH GATE
  const cookieStore = await cookies();
  const isAuthorized = cookieStore.get(`event_auth_${eventId}`);
  if (!isAuthorized) redirect(`/guest/event/${eventId}`);

  // 2. CONCURRENT META FETCH
  const [person, event] = await Promise.all([
    prisma.person.findUnique({
      where: { id: personId },
      select: { name: true },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { guestUploadPolicy: true, title: true },
    }),
  ]);

  if (!personId || !person) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Lock className="text-[#c94a20] mx-auto" size={48} />
          <h2 className="text-white font-serif text-2xl">
            Identity Link Broken
          </h2>
          <p className="text-white/40 font-mono text-xs uppercase tracking-widest">
            Auth session mismatch
          </p>
        </div>
      </div>
    );
  }

  // 3. FETCH DATASETS (Matches + Personal Uploads)
  const [matchesRaw, uploadsRaw] = await Promise.all([
    prisma.asset.findMany({
      where: {
        eventId,
        faceDetections: { some: { personId } },
        status: "processed",
        moderationState: "approved",
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.findMany({
      where: { eventId, uploaderId: personId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // 4. SECURE S3 HANDSHAKE (Helper)
  const generateUrls = async (assets: any[]) =>
    Promise.all(
      assets.map(async (photo) => {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: photo.storageKey,
          });
          const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
          });
          return { ...photo, signedUrl };
        } catch (err) {
          return { ...photo, signedUrl: null };
        }
      }),
    );

  const [matches, uploads] = await Promise.all([
    generateUrls(matchesRaw),
    generateUrls(uploadsRaw),
  ]);

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0f] text-white relative selection:bg-[#c94a20]/30 font-sans overflow-x-hidden">
      {/* Cinematic Background Pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(#c94a20 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient Orb */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#c94a20]/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 px-4 sm:px-8 py-12 max-w-7xl mx-auto flex flex-col min-h-screen">
        {/* PAGE HEADER */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="space-y-6">
            {/* SYSTEM PILLS */}
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-xl">
                <ShieldCheck size={14} className="text-green-500" />
                <span className="text-[10px] font-mono text-white/60 uppercase tracking-[0.2em] font-bold">
                  Identity Verified
                </span>
              </div>

              {/* NEW: VAULT NAME PILL */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#c94a20]/10 border border-[#c94a20]/30 rounded-full backdrop-blur-md shadow-xl">
                <div className="w-1.5 h-1.5 bg-[#c94a20] rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-[#c94a20] uppercase tracking-[0.2em] font-bold">
                  Vault: {event?.title || "Unknown Archive"}
                </span>
              </div>
              <LogoutButton eventId={eventId} />
            </div>


            <div className="space-y-4">
              {/* METADATA LINE */}
              <div className="flex items-center gap-4 text-[10px] font-mono text-white/30 uppercase tracking-[0.3em]">
                <span>
                  Session:{" "}
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h1 className="text-6xl sm:text-7xl font-serif font-bold tracking-tighter text-white leading-[0.95]">
                Welcome back,
                <br />
                <span className="text-[#c94a20] italic drop-shadow-[0_0_30px_rgba(201,74,32,0.2)]">
                  {person.name || "Guest"}
                </span>
              </h1>

              <div className="flex items-center gap-4 text-white/40 font-mono text-[11px] uppercase tracking-[0.2em]">
                <Activity
                  size={14}
                  className={
                    matches.length === 0
                      ? "text-[#c8b89a] animate-pulse"
                      : "text-[#c94a20]"
                  }
                />
                {matches.length === 0 ? (
                  "Scanning Vault Database..."
                ) : (
                  <>
                    <span className="text-white font-bold">
                      {matches.length}
                    </span>{" "}
                    Encrypted Memories Found
                  </>
                )}
              </div>
            </div>
          </div>

          {/* UPLOAD ACTION */}
          {event?.guestUploadPolicy !== "closed" && (
            <div className="shrink-0 animate-in fade-in zoom-in-95 delay-300 duration-1000">
              <GuestUploadTrigger eventId={eventId} personId={personId} />
            </div>
          )}
        </header>

        {/* INTERACTIVE GALLERY CLIENT */}
        <div className="flex-1">
          <GuestGalleryClient
            matches={matches}
            uploads={uploads}
            eventTitle={event?.title || "Vault"}
            eventId={eventId} 
            personId={personId}
          />
        </div>

        {/* TELEMETRY FOOTER */}
        <footer className="mt-20 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-6 text-[10px] text-white/30 font-mono uppercase tracking-[0.3em]">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
            VAULT STATUS: <span className="text-white">{event?.title}</span>
          </div>
          <div className="flex gap-8 items-center">
            <span className="hidden sm:inline border-r border-white/10 pr-8">
              Protocol: AES-256
            </span>
            <span className="text-white/50">
              SECURE NODE: {isAuthorized.value.slice(0, 12)}
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
