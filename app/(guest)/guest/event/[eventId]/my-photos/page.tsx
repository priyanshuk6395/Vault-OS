import { prisma } from "@/lib/prisma";
import GuestUploadTrigger from "@/components/guest/GuestUploadTrigger";
import GuestGalleryClient from "@/components/guest/GuestGalleryClient";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { notFound, redirect } from "next/navigation";
import { hasValidGuestPersonSession } from "@/lib/guest-session";
import { ShieldCheck, Activity, Lock } from "lucide-react";
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
  const isAuthorized = typeof personId === "string" && await hasValidGuestPersonSession(eventId, personId);
  if (!isAuthorized) redirect(`/guest/event/${eventId}`);

  // 2. CONCURRENT META FETCH
  const [person, event] = await Promise.all([
    prisma.person.findFirst({
      where: { id: personId, eventId },
      select: { name: true },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { guestUploadPolicy: true, biometricSearch: true, title: true },
    }),
  ]);
  if (!event?.biometricSearch) redirect(`/guest/event/${eventId}`);
  if (!event) notFound();

  if (!personId || !person) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <Lock className="text-primary mx-auto" size={48} />
          <h2 className="text-foreground font-serif text-2xl">
            Identity Link Broken
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
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
  const generateUrls = async <T extends { storageKey: string }>(assets: T[]) =>
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
        } catch (error) {
          console.error("[GUEST_MEDIA_SIGN_ERROR]:", error);
          return { ...photo, signedUrl: null };
        }
      }),
    );

  const [matches, uploads] = await Promise.all([
    generateUrls(matchesRaw),
    generateUrls(uploadsRaw),
  ]);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground relative selection:bg-primary/20 font-sans overflow-x-hidden">
      {/* Cinematic Background Pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(var(--accent-coral) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient Orb */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-coral/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 px-4 sm:px-8 py-12 max-w-7xl mx-auto flex flex-col min-h-screen">
        {/* PAGE HEADER */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="space-y-6">
            {/* SYSTEM PILLS */}
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full shadow-sm">
                <ShieldCheck size={14} className="text-accent-teal" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] font-bold">
                  Identity Verified
                </span>
              </div>

              {/* NEW: VAULT NAME PILL */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full shadow-sm">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] font-bold">
                  Vault: {event?.title || "Unknown Archive"}
                </span>
              </div>
              <LogoutButton eventId={eventId} />
            </div>


            <div className="space-y-4">
              {/* METADATA LINE */}
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em]">
                <span>
                  Session:{" "}
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <h1 className="text-6xl sm:text-7xl font-serif font-bold tracking-tighter text-foreground leading-[0.95]">
                Welcome back,
                <br />
                <span className="text-primary italic">
                  {person.name || "Guest"}
                </span>
              </h1>

              <div className="flex items-center gap-4 text-muted-foreground font-mono text-[11px] uppercase tracking-[0.2em]">
                <Activity
                  size={14}
                  className={
                    matches.length === 0
                      ? "text-accent-amber animate-pulse"
                      : "text-primary"
                  }
                />
                {matches.length === 0 ? (
                  "Scanning Vault Database..."
                ) : (
                  <>
                    <span className="text-foreground font-bold">
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
        <footer className="mt-20 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-6 text-[10px] text-muted-foreground font-mono uppercase tracking-[0.3em]">
          <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full border border-border">
            <div className="w-1.5 h-1.5 bg-accent-teal rounded-full animate-pulse shadow-[0_0_10px_var(--accent-teal)]" />
            VAULT STATUS: <span className="text-foreground">{event?.title}</span>
          </div>
          <div className="flex gap-8 items-center">
            <span className="hidden sm:inline border-r border-border pr-8">
              Protocol: AES-256
            </span>
            <span className="text-muted-foreground">
              SECURE NODE: VERIFIED
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
