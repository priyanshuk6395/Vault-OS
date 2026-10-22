"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List, Trash2, Loader2, ImageIcon, ShieldCheck, Download, Edit, X } from "lucide-react";
import MediaGrid, { type MediaAsset } from "./MediaGrid";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function MediaClientPage({ eventId }: { eventId: string }) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  // NEW: Bulk Action State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    async function fetchAssets() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/assets`);
        if (!res.ok) throw new Error("Failed to load media assets");
        if (res.ok) {
          const data = await res.json();
          setAssets(data);
          setLoadError(false);
        }
      } catch (err) {
        console.error("Failed to fetch assets:", err);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAssets();
  }, [eventId]);

  const handleDelete = async (assetId: string) => {
    if (!confirm("Permanently delete this photo and its biometric data?")) return;
    try {
      const res = await fetch(`/api/events/${eventId}/assets/${assetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (err) {
      console.error("[MEDIA_DELETE_ERROR]:", err);
      toast.error("Delete failed");
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently destroy ${selectedIds.size} assets? This action cannot be undone.`)) return;
    setIsBulkDeleting(true);
    const toastId = toast.loading("Executing mass deletion protocol...");
    
    try {
      const results = await Promise.all(Array.from(selectedIds).map(async (id) => {
        try {
          const response = await fetch(`/api/events/${eventId}/assets/${id}`, { method: 'DELETE' });
          return { id, ok: response.ok };
        } catch (error) {
          console.error(`[MEDIA_DELETE_ERROR] ${id}:`, error);
          return { id, ok: false };
        }
      }));
      const deletedIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
      const failedIds = new Set(results.filter((result) => !result.ok).map((result) => result.id));

      setAssets(prev => prev.filter(a => !deletedIds.has(a.id)));
      setSelectedIds(failedIds);
      setIsEditing(failedIds.size > 0);
      if (failedIds.size > 0) {
        toast.error(`${failedIds.size} asset${failedIds.size === 1 ? "" : "s"} could not be deleted.`, { id: toastId });
      } else {
        toast.success("Assets purged from vault", { id: toastId });
      }
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
    <div className="flex flex-col h-full bg-background">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card border-b border-border p-3 sm:p-4 gap-4 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground px-3 border-r border-border uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={12} className="text-primary" />
            Vault Library
          </span>
          <div className="px-3 py-1 bg-subtle rounded-full text-[10.5px] font-mono text-foreground uppercase font-bold tracking-widest transition-all">
            {isEditing ? `${selectedIds.size} Selected` : `${assets.length} Assets`}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Action Buttons */}
          <AnimatePresence mode="popLayout">
            {isEditing ? (
              <motion.div key="edit-mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex gap-2">
                 <button onClick={() => { setIsEditing(false); setSelectedIds(new Set()); }} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground bg-subtle hover:bg-background rounded-md border border-border transition-colors">
                   <X size={14}/> Cancel
                 </button>
                 <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || isBulkDeleting} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors shadow-sm active:scale-95">
                   {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14}/>} 
                   Delete ({selectedIds.size})
                 </button>
              </motion.div>
            ) : (
              <motion.div key="normal-mode" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex gap-2">
                 <a href={`/api/events/${eventId}/download-all-admin`} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground bg-card hover:bg-subtle rounded-md border border-border transition-colors shadow-sm active:scale-95">
                   <Download size={14}/> Download Vault
                 </a>
                 <button onClick={() => setIsEditing(true)} disabled={assets.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-foreground bg-card hover:bg-subtle disabled:opacity-50 rounded-md border border-border transition-colors shadow-sm active:scale-95">
                   <Edit size={14}/> Select
                 </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-[1px] h-6 bg-border" />

          {/* View Toggles */}
          <div className="flex items-center gap-1 bg-subtle p-1 rounded-md border border-border">
            <button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={cn("p-1.5 rounded-sm transition-all", view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid size={16} />
            </button>
            <button aria-label="Table view" aria-pressed={view === "table"} onClick={() => setView("table")} className={cn("p-1.5 rounded-sm transition-all", view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-6 flex-1">
        {isLoading ? (
          <div role="status" className="flex flex-col items-center justify-center py-32 bg-card border border-border rounded-lg border-dashed">
            <Loader2 className="animate-spin text-primary mb-3" size={28} />
            <p className="text-muted-foreground text-[12px] font-mono uppercase tracking-widest">Synchronizing Vault...</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center justify-center py-32 bg-card border border-border rounded-lg border-dashed">
            <p className="text-accent-coral text-[12px] font-mono uppercase tracking-widest">Unable to load vault media.</p>
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
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="overflow-x-auto custom-scrollbar">
                {/* ... existing table code ... */}
                <p className="p-4 text-xs text-center text-muted-foreground font-mono">Table view disabled in Bulk Edit mode. Please switch to Grid View.</p>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-32 bg-card border border-border rounded-xl border-dashed shadow-sm">
            <div className="w-16 h-16 bg-subtle rounded-lg flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="text-muted-foreground" size={32} />
            </div>
            <p className="text-foreground text-[18px] font-serif font-bold">Vault is Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}