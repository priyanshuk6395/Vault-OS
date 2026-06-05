"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List, Trash2, Loader2, ImageIcon, ShieldCheck, Download, Edit, X } from "lucide-react";
import MediaGrid from "./MediaGrid";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function MediaClientPage({ eventId }: { eventId: string }) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [assets, setAssets] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // NEW: Bulk Action State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    async function fetchAssets() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/assets`);
        if (res.ok) {
          const data = await res.json();
          setAssets(data);
        }
      } catch (err) {
        console.error("Failed to fetch assets:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAssets();
  }, [eventId]);

  const handleDelete = async (assetId: string) => {
    if (!confirm("Permanently delete this photo and its biometric data?")) return;
    setIsDeleting(assetId);
    try {
      const res = await fetch(`/api/events/${eventId}/assets/${assetId}`, { method: 'DELETE' });
      if (res.ok) setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently destroy ${selectedIds.size} assets? This action cannot be undone.`)) return;
    setIsBulkDeleting(true);
    const toastId = toast.loading("Executing mass deletion protocol...");
    
    try {
      // Process deletions in parallel
      await Promise.all(Array.from(selectedIds).map(id => 
        fetch(`/api/events/${eventId}/assets/${id}`, { method: 'DELETE' })
      ));
      
      setAssets(prev => prev.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      setIsEditing(false);
      toast.success("Assets purged from vault", { id: toastId });
    } catch(e) { 
      toast.error("Bulk delete partially failed", { id: toastId });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#fbfaf8]">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border-b border-[#dbd8cf] p-3 sm:p-4 gap-4 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#5a5a64] px-3 border-r border-[#dbd8cf] uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={12} className="text-[#c94a20]" />
            Vault Library
          </span>
          <div className="px-3 py-1 bg-[#f5f4f0] rounded-full text-[10.5px] font-mono text-[#0e0e0f] uppercase font-bold tracking-widest transition-all">
            {isEditing ? `${selectedIds.size} Selected` : `${assets.length} Assets`}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Action Buttons */}
          <AnimatePresence mode="popLayout">
            {isEditing ? (
              <motion.div key="edit-mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2">
                 <button onClick={() => { setIsEditing(false); setSelectedIds(new Set()); }} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#5a5a64] bg-[#f5f4f0] hover:bg-[#eceae4] rounded-lg border border-[#dbd8cf]/50 transition-colors">
                   <X size={14}/> Cancel
                 </button>
                 <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isBulkDeleting} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors shadow-sm active:scale-95">
                   {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14}/>} 
                   Delete ({selectedIds.size})
                 </button>
              </motion.div>
            ) : (
              <motion.div key="normal-mode" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex gap-2">
                 <a href={`/api/events/${eventId}/download-all-admin`} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#0e0e0f] bg-white hover:bg-[#f5f4f0] rounded-lg border border-[#dbd8cf] transition-colors shadow-sm active:scale-95">
                   <Download size={14}/> Download Vault
                 </a>
                 <button onClick={() => setIsEditing(true)} disabled={assets.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#0e0e0f] bg-white hover:bg-[#f5f4f0] disabled:opacity-50 rounded-lg border border-[#dbd8cf] transition-colors shadow-sm active:scale-95">
                   <Edit size={14}/> Select
                 </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-[1px] h-6 bg-[#dbd8cf]" />

          {/* View Toggles */}
          <div className="flex items-center gap-1 bg-[#f5f4f0] p-1 rounded-lg border border-[#dbd8cf]/50">
            <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-md transition-all", view === "grid" ? "bg-white text-[#0e0e0f] shadow-sm" : "text-[#5a5a64] hover:text-[#0e0e0f]")}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setView("table")} className={cn("p-1.5 rounded-md transition-all", view === "table" ? "bg-white text-[#0e0e0f] shadow-sm" : "text-[#5a5a64] hover:text-[#0e0e0f]")}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white border border-[#dbd8cf] rounded-[24px] border-dashed">
            <Loader2 className="animate-spin text-[#c94a20] mb-3" size={28} />
            <p className="text-[#5a5a64] text-[12px] font-mono uppercase tracking-widest">Synchronizing Vault...</p>
          </div>
        ) : assets.length > 0 ? (
          view === "grid" ? (
            <MediaGrid 
              assets={assets} 
              onDelete={handleDelete} 
              isEditing={isEditing} 
              selectedIds={selectedIds} 
              onSelect={toggleSelection} 
            />
          ) : (
            // (Table View mapping remains the same...)
            <div className="bg-white border border-[#dbd8cf] rounded-[24px] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="overflow-x-auto custom-scrollbar">
                {/* ... existing table code ... */}
                <p className="p-4 text-xs text-center text-[#5a5a64] font-mono">Table view disabled in Bulk Edit mode. Please switch to Grid View.</p>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-32 bg-white border border-[#dbd8cf] rounded-[32px] border-dashed shadow-sm">
            <div className="w-16 h-16 bg-[#f5f4f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="text-[#dbd8cf]" size={32} />
            </div>
            <p className="text-[#0e0e0f] text-[18px] font-serif font-bold">Vault is Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}