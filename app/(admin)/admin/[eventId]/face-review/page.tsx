import { prisma } from "@/lib/prisma";
import FaceReviewClient from "@/components/admin/FaceReviewClient";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/aws";
import { notFound } from "next/navigation";
import { ScanFace, CheckCircle2, Cpu } from "lucide-react";

export default async function FaceReviewPage({ 
  params 
}: { 
  params: Promise<{ eventId: string }> 
}) {
  // 1. DYNAMIC UNWRAPPING
  const { eventId } = await params;

  // 2. CONCURRENT FETCH: Event Meta & Unnamed Queue
  // We fetch both simultaneously to cut the database wait time in half
  const [event, queueRaw] = await Promise.all([
    prisma.event.findUnique({ 
      where: { id: eventId }, 
      select: { title: true } 
    }),
    prisma.person.findMany({
      where: { 
        eventId, 
        status: 'unnamed' 
      },
      include: {
        faceDetections: { 
          take: 1, 
          include: { asset: true },
          orderBy: { confidence: 'desc' } // Grab their clearest, highest-confidence photo
        }
      },
      take: 24, // Optimized for 2, 3, or 4 column grids
      orderBy: { createdAt: 'desc' }
    })
  ]);

  if (!event) return notFound();

  // 3. GENERATE SECURE PREVIEWS
  const queue = await Promise.all(
    queueRaw.map(async (person) => {
      const face = person.faceDetections[0];
      
      // Safety check in case a person has no detections
      if (!face) return null;

      try {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: face.asset.storageKey,
        });
        
        const faceUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        return { 
          ...person, 
          faceUrl, 
          eventId  
        };
      } catch (error) {
        console.error(`Failed to sign URL for face ${face.id}`);
        return null;
      }
    })
  );

  // Filter out any nulls from safety checks or S3 failures
  const filteredQueue = queue.filter(Boolean);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-accent-amber/10 text-accent-amber border border-accent-amber/20 text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Cpu size={12} /> Biometric Resolution Engine
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{event.title}</span>
            <span className="text-border font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-muted-foreground font-sans font-normal text-[22px] shrink-0">Face Review</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 font-medium">
            Train the AI by assigning identities to newly clustered biometric profiles.
          </p>
        </div>

        {/* Dynamic Counter HUD */}
        {filteredQueue.length > 0 && (
          <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-lg shadow-sm shrink-0">
            <div className="w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
            <span className="text-[11px] font-mono text-foreground uppercase tracking-widest font-bold">
              {filteredQueue.length} Entities Queued
            </span>
          </div>
        )}
      </header>

      {/* DYNAMIC CONTENT AREA */}
      {filteredQueue.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[400px] shadow-sm p-4 sm:p-6">
          <FaceReviewClient queue={filteredQueue} />
        </div>
      ) : (
        <div className="text-center py-20 sm:py-32 bg-card border border-border border-dashed rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-accent-teal/10 text-accent-teal rounded-lg flex items-center justify-center mx-auto mb-4 border border-accent-teal/20">
            <CheckCircle2 size={32} />
          </div>
          <p className="text-foreground text-[18px] sm:text-[20px] font-serif font-bold">Biometric Queue Clear</p>
          <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-1 mb-3">All detected faces have been successfully identified and merged.</p>
          <p className="text-accent-amber font-mono text-[10px] uppercase tracking-widest">AI Confidence is High</p>
        </div>
      )}
    </div>
  );
}