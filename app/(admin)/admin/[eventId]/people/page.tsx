import { prisma } from "@/lib/prisma";
import PeopleGallery from "@/components/admin/PeopleGallery";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/aws";
import { notFound } from "next/navigation";
import PurgeButton from "@/components/admin/PurgeButton";
import { Users, Fingerprint } from "lucide-react";

export default async function PeoplePage({ 
  params 
}: { 
  params: Promise<{ eventId: string }> 
}) {
  // 1. DYNAMIC UNWRAPPING
  const { eventId } = await params;

  // 2. CONCURRENT DATA FETCHING
  // Fetching Event Meta & Identity Roster simultaneously for maximum speed
  const [event, peopleRaw] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true }
    }),
    prisma.person.findMany({
      where: { eventId },
      include: {
        _count: { select: { faceDetections: true } },
        samples: {
          where: { isReference: true },
          include: {
            faceDetection: {
              include: { asset: true }
            }
          },
          take: 1
        }
      },
      orderBy: { status: 'asc' } // Shows 'named' / 'unnamed' in a predictable order
    })
  ]);

  if (!event) return notFound();

  // 3. SECURE S3 HANDSHAKE & METADATA INJECTION
  const people = await Promise.all(
    peopleRaw.map(async (person) => {
      const sample = person.samples[0]?.faceDetection;
      let faceUrl = null;

      if (sample?.asset?.storageKey) {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: sample.asset.storageKey,
          });
          // Link expires in 1 hour for high-security isolation
          faceUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        } catch (error) {
          console.error(`S3 Signature Failed for sample in person ${person.id}`);
        }
      }

      return {
        ...person,
        faceUrl,
      };
    })
  );

  // Quick stats for the Telemetry HUD
  const namedCount = people.filter(p => p.status === 'named').length;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Users size={12} /> Identity Roster
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{event.title}</span>
            <span className="text-border font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-muted-foreground font-sans font-normal text-[22px] shrink-0">People</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 font-medium">
            Manage biometric profiles and resolve unnamed guests detected by the AI.
          </p>
        </div>

        {/* Action & Telemetry Panel */}
        <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full sm:w-auto">
          {people.length > 0 && (
            <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-lg shadow-sm w-full sm:w-auto justify-center">
              <Fingerprint size={14} className="text-accent-teal" />
              <span className="text-[11px] font-mono text-foreground uppercase tracking-widest font-bold">
                {namedCount} / {people.length} Resolved
              </span>
            </div>
          )}
          
          <div className="w-full sm:w-auto">
            <PurgeButton eventId={eventId} />
          </div>
        </div>
      </header>

      {/* DYNAMIC CONTENT AREA */}
      {people.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[400px] shadow-sm p-4 sm:p-6">
          <PeopleGallery people={people} />
        </div>
      ) : (
        <div className="text-center py-20 sm:py-32 bg-card border border-border border-dashed rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-subtle rounded-lg flex items-center justify-center mx-auto mb-4 border border-border">
            <Users className="text-muted-foreground" size={32} />
          </div>
          <p className="text-foreground text-[18px] sm:text-[20px] font-serif font-bold">No Identities Found</p>
          <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-1 mb-3">The biometric index is currently empty.</p>
          <p className="text-accent-amber font-mono text-[10px] uppercase tracking-widest">Awaiting Clustering Protocols</p>
        </div>
      )}
    </div>
  );
}