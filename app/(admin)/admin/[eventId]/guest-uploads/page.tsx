import { prisma } from "@/lib/prisma";
import GuestUploadClient from "@/components/admin/GuestUploadClient";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/aws";
import { notFound } from "next/navigation";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

export default async function GuestUploadsPage({ 
  params 
}: { 
  params: Promise<{ eventId: string }> 
}) {
  // 1. DYNAMIC UNWRAPPING
  const { eventId } = await params;

  // 2. CONCURRENT FETCH: Event Meta & Guest Identities
  const [event, personsRaw] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true }
    }),
    prisma.person.findMany({
      where: { eventId },
      select: { id: true, name: true }
    })
  ]);

  if (!event) return notFound();

  // Create O(1) Lookup Map for Guest Identities
  const personMap = new Map(personsRaw.map(p => [p.id, p.name]));

  // 3. FETCH PENDING ASSETS
  const pendingAssets = await prisma.asset.findMany({
    where: { 
      eventId,
      moderationState: 'pending'
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. GENERATE SECURE PREVIEWS & RESOLVE IDENTITIES
  const uploads = await Promise.all(
    pendingAssets.map(async (asset) => {
      let url = null;
      if (asset.storageKey) {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: asset.storageKey,
          });
          url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        } catch (s3Error) {
          console.error(`S3 Signature Failed for ${asset.id}`);
        }
      }

      // Resolve Guest Identity
      let uploaderName = "Unknown Guest";
      if (asset.uploaderId && personMap.has(asset.uploaderId)) {
        uploaderName = personMap.get(asset.uploaderId) || "Unnamed Guest";
      }

      // Inject previewUrl and uploaderName into the payload
      return { ...asset, previewUrl: url, uploaderName };
    })
  );

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-accent-amber/10 text-accent-amber border border-accent-amber/20 text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <ShieldAlert size={12} /> Moderation Queue
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{event.title}</span>
            <span className="text-border font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-muted-foreground font-sans font-normal text-[22px] shrink-0">Guest Uploads</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 font-medium">
            Review and approve community contributions before triggering biometric ingestion.
          </p>
        </div>

        {/* Dynamic Counter HUD */}
        {uploads.length > 0 && (
          <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-lg shadow-sm shrink-0">
            <div className="w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
            <span className="text-[11px] font-mono text-foreground uppercase tracking-widest font-bold">
              {uploads.length} Pending
            </span>
          </div>
        )}
      </header>

      {/* DYNAMIC CONTENT AREA */}
      {uploads.length > 0 ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[400px] shadow-sm p-4 sm:p-6">
          {/* Note: Update your GuestUploadClient to read asset.uploaderName! */}
          <GuestUploadClient initialUploads={uploads} eventId={eventId} />
        </div>
      ) : (
        <div className="text-center py-20 sm:py-32 bg-card border border-border border-dashed rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-accent-teal/10 text-accent-teal rounded-lg flex items-center justify-center mx-auto mb-4 border border-accent-teal/20">
            <CheckCircle2 size={32} />
          </div>
          <p className="text-foreground text-[18px] sm:text-[20px] font-serif font-bold">Inbox Zero</p>
          <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-1 mb-3">No guest uploads awaiting moderation.</p>
          <p className="text-accent-amber font-mono text-[10px] uppercase tracking-widest">Vault is Secure</p>
        </div>
      )}
    </div>
  );
}