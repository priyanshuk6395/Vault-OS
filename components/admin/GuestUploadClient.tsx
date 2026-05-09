"use client";

import { useState } from "react";
import { Check, X, Loader2, CheckCheck, Trash2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { cn } from "@/lib/utils";
import { toast } from "sonner"; 

export default function GuestUploadClient({ 
  initialUploads, 
  eventId 
}: { 
  initialUploads: any[], 
  eventId: string 
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleModeration = async (assetId: string, action: 'approve' | 'reject') => {
    setProcessingId(assetId);
    try {
      const res = await fetch(`/api/admin/moderate-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, action, eventId }),
      });

      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== assetId));
        toast.success(action === 'approve' ? "Asset Approved" : "Asset Rejected", {
            description: action === 'approve' ? "Routing to AI pipeline." : "Asset deleted from vault.",
        });
      }
    } catch (err) {
      console.error("Moderation failed", err);
      toast.error("Moderation Failed");
    } finally {
      setProcessingId(null);
    }
  };

  const approveAll = async () => {
    if (!confirm(`Approve all ${uploads.length} pending uploads?`)) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading("Processing Bulk Approval...");
    
    try {
      await Promise.all(uploads.map(u => 
        fetch(`/api/admin/moderate-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: u.id, action: 'approve', eventId }),
        })
      ));
      setUploads([]);
      toast.success("Bulk Approval Complete", { id: toastId });
    } catch (error) {
        toast.error("Bulk Approval Failed", { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions Bar */}
      {uploads.length > 1 && (
        <div className="flex justify-between items-center pb-2 border-b border-[#eceae4]">
          <div className="text-[11px] font-mono text-[#5a5a64] uppercase tracking-widest">
            {uploads.length} Assets Awaiting Review
          </div>
          <button 
            onClick={approveAll}
            disabled={isBulkProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-[#e6f5ee] text-[#2a7a4f] rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#d1ebd9] transition-all disabled:opacity-50 active:scale-95"
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
              className="bg-white border border-[#dbd8cf] rounded-2xl overflow-hidden flex flex-col group shadow-sm hover:shadow-xl hover:shadow-[#c94a20]/10 transition-all"
            >
              <div className="aspect-[4/3] relative bg-[#eceae4] overflow-hidden">
                <img 
                  src={asset.previewUrl} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  alt="Guest content" 
                />
                
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
              
              <div className="p-4 bg-white z-10 flex-1 flex flex-col justify-between">
                <p className="text-[12.5px] font-bold text-[#0e0e0f] truncate font-serif mb-3">
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
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#e6f5ee] hover:bg-[#d1ebd9] text-[#2a7a4f] rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <Check size={14} /> Approve
                  </button>
                </div>

                {/* Guest Uploader Tag */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#f5f4f0]">
                    <div className="flex items-center gap-1.5 bg-[#f5f4f0] px-2 py-1 rounded-md border border-[#dbd8cf]/50">
                        <User size={10} className="text-[#c94a20]" />
                        <span className="text-[9px] font-mono text-[#5a5a64] uppercase tracking-widest truncate max-w-[100px]">
                            {asset.uploaderName || "Unknown Guest"}
                        </span>
                    </div>

                    <span className="text-[9px] text-[#c8b89a] font-mono uppercase tracking-[0.1em]">
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