"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import MediaClientPage from "@/components/admin/MediaClientPage";
import UploadDialog from "@/components/admin/UploadDialog";
import { toast } from "sonner";
import { CloudUpload, Fingerprint, Image as ImageIcon } from "lucide-react";

export default function MediaPage() {
  const params = useParams();
  const eventId = params.eventId as string; 
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [eventTitle, setEventTitle] = useState<string>("Loading...");

  useEffect(() => {
    if (!eventId) return;

    async function fetchEventTitle() {
      try {
        const res = await fetch(`/api/events/${eventId}/stats`); 
        const data = await res.json();
        if (data.title) {
          setEventTitle(data.title);
        } else {
          setEventTitle("Event Vault");
        }
      } catch (err) {
        setEventTitle("Event Vault");
      }
    }

    fetchEventTitle();
  }, [eventId]);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
    toast.success("Library Updated", {
      description: "New assets have been synced to the vault.",
      icon: <Fingerprint className="w-4 h-4 text-[#c94a20]" />,
    });
  };

  if (!eventId) return null;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* 1. RESPONSIVE ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[#dbd8cf] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-[#0e0e0f] text-white text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <ImageIcon size={12} /> Asset Manager
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-[#0e0e0f] tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md md:max-w-lg">{eventTitle}</span>
            <span className="text-[#dbd8cf] font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-[#5a5a64] font-sans font-normal text-[22px] shrink-0">Media</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-[#5a5a64] mt-1 font-medium">
            Vault Node: <span className="font-mono text-[#c94a20] uppercase">{eventId.slice(0, 12)}</span>
          </p>
        </div>
        
        <button 
          onClick={() => {
            setIsUploadOpen(true);
            toast("Initializing Upload Protocol", {
              description: "Ready to ingest new biometric assets.",
            });
          }}
          className="group w-full sm:w-auto shrink-0 flex items-center justify-center gap-3 px-6 py-3.5 sm:py-3 bg-[#0e0e0f] text-white rounded-xl text-[12px] font-bold uppercase tracking-widest hover:bg-[#c94a20] transition-all shadow-lg shadow-black/10 active:scale-95"
        >
          <CloudUpload size={16} className="group-hover:-translate-y-0.5 transition-transform" />
          Ingest Media
        </button>
      </header>

      {/* 2. THE GRID WITH REFRESH LOGIC */}
      <div className="bg-white border border-[#dbd8cf] rounded-[24px] sm:rounded-[32px] overflow-hidden min-h-[400px] shadow-sm">
        <MediaClientPage key={refreshKey} eventId={eventId} />
      </div>

      <UploadDialog 
        eventId={eventId} 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}