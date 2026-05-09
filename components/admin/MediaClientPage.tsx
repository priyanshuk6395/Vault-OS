"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List, Trash2, Loader2, ImageIcon, ShieldCheck } from "lucide-react";
import MediaGrid from "./MediaGrid";
import { cn } from "@/lib/utils";

export default function MediaClientPage({ eventId }: { eventId: string }) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [assets, setAssets] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetching assets scoped to the current event
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
      if (res.ok) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
      }
    } catch (err) {
      alert("Delete failed");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fbfaf8]">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border-b border-[#dbd8cf] p-3 sm:p-4 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#5a5a64] px-3 border-r border-[#dbd8cf] uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={12} className="text-[#c94a20]" />
            Vault Library
          </span>
          <div className="px-3 py-1 bg-[#f5f4f0] rounded-full text-[10.5px] font-mono text-[#0e0e0f] uppercase font-bold tracking-widest">
            {assets.length} Assets
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#f5f4f0] p-1 rounded-lg border border-[#dbd8cf]/50 self-start sm:self-auto">
          <button 
            onClick={() => setView("grid")} 
            className={cn("p-1.5 rounded-md transition-all", view === "grid" ? "bg-white text-[#0e0e0f] shadow-sm" : "text-[#5a5a64] hover:text-[#0e0e0f]")}
          >
            <LayoutGrid size={16} />
          </button>
          <button 
            onClick={() => setView("table")} 
            className={cn("p-1.5 rounded-md transition-all", view === "table" ? "bg-white text-[#0e0e0f] shadow-sm" : "text-[#5a5a64] hover:text-[#0e0e0f]")}
          >
            <List size={16} />
          </button>
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
            <MediaGrid assets={assets} onDelete={handleDelete} />
          ) : (
            <div className="bg-white border border-[#dbd8cf] rounded-[24px] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-[12.5px] min-w-[600px]">
                  <thead className="bg-[#f5f4f0] font-mono text-[9.5px] uppercase text-[#5a5a64] tracking-widest border-b border-[#dbd8cf]">
                    <tr>
                      <th className="px-6 py-4 whitespace-nowrap">Preview</th>
                      <th className="px-6 py-4 whitespace-nowrap">Source Identity</th>
                      <th className="px-6 py-4 whitespace-nowrap">Pipeline Status</th>
                      <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} className="border-t border-[#eceae4] hover:bg-[#fdf2e0]/30 transition-colors group">
                        {/* Preview Image */}
                        <td className="px-6 py-3">
                          <div className="w-14 h-14 bg-[#eceae4] rounded-xl overflow-hidden border border-[#dbd8cf]/50 shadow-inner">
                            {a.url ? (
                              <img src={a.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#c8b89a]">
                                <ImageIcon size={16} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Filename & ID */}
                        <td className="px-6 py-3">
                          <div className="font-semibold text-[#0e0e0f] truncate max-w-[200px]">{a.sourceFilename}</div>
                          <div className="text-[10px] text-[#5a5a64] font-mono uppercase tracking-widest mt-1">
                            HASH: {a.id.slice(0,8)}
                          </div>
                        </td>

                        {/* Dual Status Column */}
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-1.5 items-start">
                            {/* 🚨 Updated to 'processed' */}
                            <span className={cn(
                              "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                              a.status === "processed" ? "bg-[#e6f5ee] text-[#2a7a4f]" : "bg-[#f5f4f0] text-[#5a5a64]"
                            )}>
                              AI: {a.status}
                            </span>
                            {/* Added Moderation State */}
                            <span className={cn(
                              "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                              a.moderationState === "approved" ? "bg-[#e6f5ee] text-[#2a7a4f]" : "bg-[#fdf2e0] text-[#a06010]"
                            )}>
                              MOD: {a.moderationState}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => handleDelete(a.id)}
                            disabled={isDeleting === a.id}
                            className="p-2.5 bg-white border border-[#dbd8cf] rounded-lg text-[#5a5a64] hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50 inline-flex items-center justify-center"
                          >
                            {isDeleting === a.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-32 bg-white border border-[#dbd8cf] rounded-[32px] border-dashed shadow-sm">
            <div className="w-16 h-16 bg-[#f5f4f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="text-[#dbd8cf]" size={32} />
            </div>
            <p className="text-[#0e0e0f] text-[18px] font-serif font-bold">Vault is Empty</p>
            <p className="text-[#c8b89a] text-[11px] mt-2 font-mono uppercase tracking-widest">Awaiting Initial Ingestion</p>
          </div>
        )}
      </div>
    </div>
  );
}