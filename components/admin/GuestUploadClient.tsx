"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Loader2, CheckCheck, Trash2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { toast } from "sonner"; 

interface GuestUpload {
  id: string;
  previewUrl: string | null;
  sourceFilename: string | null;
  uploaderName: string | null;
  createdAt: string | Date;
}

export default function GuestUploadClient({ 
  initialUploads,
  eventId 
}: { 
  initialUploads: GuestUpload[],
  eventId: string 
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleModeration = async (assetId: string, action: 'approve' | 'reject') => {
    if (action === "reject" && !confirm("Permanently reject this upload and delete its biometric data?")) return;
    setProcessingId(assetId);
    try {
      const res = await fetch(`/api/admin/moderate-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, action, eventId }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => null);
        throw new Error(result?.error || `Moderation failed (${res.status})`);
      }
      setUploads((prev) => prev.filter((u) => u.id !== assetId));
      toast.success(action === 'approve' ? "Asset Approved" : "Asset Rejected", {
        description: action === 'approve' ? "Routing to AI pipeline." : "Asset deleted from vault.",
      });
    } catch (err) {
      console.error("Moderation failed", err);
      toast.error(err instanceof Error ? err.message : "Moderation Failed");
    } finally {
      setProcessingId(null);
    }
  };

  const approveAll = async () => {
    if (!confirm(`Approve all ${uploads.length} pending uploads?`)) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading("Processing Bulk Approval...");
    
    try {
      const results = await Promise.all(uploads.map(async (upload) => {
        const response = await fetch(`/api/admin/moderate-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: upload.id, action: 'approve', eventId }),
        });
        return { id: upload.id, ok: response.ok };
      }));
      const approvedIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
      const failedCount = results.length - approvedIds.size;
      setUploads((previous) => previous.filter((upload) => !approvedIds.has(upload.id)));
      if (failedCount > 0) {
        toast.error(`${failedCount} upload${failedCount === 1 ? "" : "s"} could not be approved.`, { id: toastId });
      } else {
        toast.success("Bulk Approval Complete", { id: toastId });
      }
    } catch (error) {
      console.error("[BULK_APPROVAL_ERROR]:", error);
      toast.error("Bulk Approval Failed", { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions Bar */}
      {uploads.length > 1 && (
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            {uploads.length} Assets Awaiting Review
          </div>
          <button 
            onClick={approveAll}
            disabled={isBulkProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-accent-teal/10 text-accent-teal rounded-md text-[12px] font-bold uppercase tracking-widest hover:bg-accent-teal/20 transition-all disabled:opacity-50 active:scale-95"
          >
            {isBulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck size={16} />}
            Approve All
          </button>
        </div>
      )}

      {/* Grid with AnimatePresence for smooth removals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {uploads.map((asset) => (
            <motion.div 
              key={asset.id} 
              layout 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
              className="bg-card border border-border rounded-lg overflow-hidden flex flex-col group shadow-sm hover:shadow-lg hover:shadow-primary/10 transition-all"
            >
              <div className="aspect-[4/3] relative bg-subtle overflow-hidden">
                {asset.previewUrl ? (
                  <Image
                    src={asset.previewUrl}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    alt="Guest content"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Preview unavailable
                  </div>
                )}
                
                {/* ACTION OVERLAY (DESKTOP ONLY) */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden lg:flex items-center justify-center gap-6">
                  <button 
                    onClick={() => handleModeration(asset.id, 'reject')}
                    disabled={!!processingId || isBulkProcessing}
                    className="flex flex-col items-center gap-2 group/btn active:scale-95 transition-transform"
                  >
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white group-hover/btn:bg-red-500 transition-colors shadow-2xl">
                      <Trash2 size={20} />
                    </div>
                    <span className="text-[10px] text-white font-mono uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity">Reject</span>
                  </button>

                  <button 
                    onClick={() => handleModeration(asset.id, 'approve')}
                    disabled={!!processingId || isBulkProcessing}
                    className="flex flex-col items-center gap-2 group/btn active:scale-95 transition-transform"
                  >
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white group-hover/btn:bg-green-500 transition-colors shadow-2xl">
                      <Check size={20} />
                    </div>
                    <span className="text-[10px] text-white font-mono uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity">Approve</span>
                  </button>
                </div>

                {processingId === asset.id && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-10">
                    <Loader2 className="animate-spin text-white" size={24} />
                    <span className="text-[10px] text-white font-mono uppercase tracking-widest">Processing...</span>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-card z-10 flex-1 flex flex-col justify-between">
                <p className="text-[12.5px] font-bold text-card-foreground truncate font-serif mb-3">
                  {asset.sourceFilename}
                </p>

                {/* MOBILE ACTION BAR (TOUCH DEVICES ONLY) */}
                <div className="flex lg:hidden items-center gap-2 mb-4">
                  <button 
                    onClick={() => handleModeration(asset.id, 'reject')}
                    disabled={!!processingId || isBulkProcessing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Reject
                  </button>
                  <button 
                    onClick={() => handleModeration(asset.id, 'approve')}
                    disabled={!!processingId || isBulkProcessing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Check size={14} /> Approve
                  </button>
                </div>

                {/* Guest Uploader Tag */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 bg-subtle px-2 py-1 rounded-md border border-border">
                    <User size={10} className="text-primary" />
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest truncate max-w-[100px]">
                            {asset.uploaderName || "Unknown Guest"}
                        </span>
                    </div>

                    <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.1em]">
                        {new Date(asset.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}