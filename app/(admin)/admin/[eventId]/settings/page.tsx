"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Globe, Trash2, Loader2, ShieldAlert,
  Database, Fingerprint, Users, ImageIcon, Activity, Settings
} from "lucide-react";
import { getEventSettings, deleteEvent } from "@/lib/actions/event-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [isPending, startTransition] = useTransition();
  const [eventData, setEventData] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    // Initial data synchronization
    getEventSettings(eventId).then(setEventData);
  }, [eventId]);

  const isDeleteReady = confirmText === eventData?.passcode;

  const handleDelete = async () => {
    if (!isDeleteReady) return;
    
    const toastId = toast.loading("Initiating Purge Protocol...");
    
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result.success) {
        toast.success("System Purged", { 
          id: toastId,
          description: "All cloud assets and database records have been destroyed." 
        });
        router.push("/admin");
      } else {
        toast.error("Purge Failed", { id: toastId, description: result.error });
      }
    });
  };

  // 1. SUPREME LOADING SKELETON
  if (!eventData) return (
    <div className="max-w-3xl pb-20 space-y-8 animate-pulse mx-auto">
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-[#dbd8cf] pb-6">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-[#eceae4] rounded" />
          <div className="h-8 w-64 bg-[#dbd8cf] rounded-lg" />
          <div className="h-3 w-40 bg-[#eceae4] rounded" />
        </div>
        <div className="h-8 w-24 bg-[#eceae4] rounded-full self-start sm:self-end" />
      </div>
      <div className="h-[200px] w-full bg-[#f5f4f0] rounded-[32px] border border-[#eceae4]" />
      <div className="h-[250px] w-full bg-[#f5f4f0] rounded-[32px] border border-[#eceae4]" />
      <div className="h-[300px] w-full bg-[#1a1a1c] rounded-[32px] border border-red-500/10" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[#dbd8cf] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-[#0e0e0f] text-white text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Settings size={12} /> System Config
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-[#0e0e0f] tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md">{eventData.title || "Vault"}</span>
            <span className="text-[#dbd8cf] font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-[#5a5a64] font-sans font-normal text-[22px] shrink-0">Settings</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-[#5a5a64] mt-1 font-medium">
            Node ID: <span className="font-mono text-[#c94a20] uppercase font-bold">{eventId.slice(0, 12)}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-[#e6f5ee] border border-[#2a7a4f]/20 rounded-xl shadow-sm self-start sm:self-auto shrink-0">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-[#2a7a4f] uppercase tracking-widest">System Live</span>
        </div>
      </header>

      <div className="space-y-6 sm:space-y-8">
        
        {/* 1. CONNECTIVITY DIAGNOSTICS */}
        <section className="bg-white border border-[#dbd8cf] p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-sm">
          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="p-3 bg-[#e6f5ee] rounded-2xl border border-[#2a7a4f]/20">
              <Activity className="text-[#2a7a4f]" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] sm:text-[18px] text-[#0e0e0f] font-serif">Service Connectivity</h3>
              <p className="text-[9px] sm:text-[10px] text-[#5a5a64] font-mono uppercase tracking-widest mt-1">Real-time Infrastructure Status</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusIndicator 
              label="PostgreSQL" 
              status={eventData.health?.database ? "online" : "offline"} 
              sub="Prisma Sync" 
            />
            <StatusIndicator 
              label="AWS S3" 
              status={eventData.health?.s3 ? "online" : "offline"} 
              sub="ap-south-1" 
            />
            <StatusIndicator 
              label="Rekognition" 
              status={eventData.health?.rekognition ? "online" : "offline"} 
              sub="Face Engine" 
            />
          </div>
        </section>

        {/* 2. DATABASE & STORAGE AUDIT */}
        <section className="bg-white border border-[#dbd8cf] p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-sm">
          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="p-3 bg-[#fdf2e0] rounded-2xl border border-[#a06010]/20">
              <Database className="text-[#a06010]" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] sm:text-[18px] text-[#0e0e0f] font-serif">Audit Metrics</h3>
              <p className="text-[9px] sm:text-[10px] text-[#5a5a64] font-mono uppercase tracking-widest mt-1">Metadata Synchronization</p>
            </div>
          </div>
          <div className="space-y-3">
            <MetricRow 
              icon={<Fingerprint size={16}/>} 
              label="Indexed Faces" 
              value={eventData.totalFaces || 0} 
              pulse 
            />
            <MetricRow 
              icon={<ImageIcon size={16}/>} 
              label="Total Assets" 
              value={eventData._count?.assets || 0} 
            />
            <MetricRow 
              icon={<Users size={16}/>} 
              label="Identified Entities" 
              value={eventData._count?.persons || 0} 
            />
          </div>
        </section>

        {/* 3. SECURE DESTRUCTION PROTOCOL */}
        <section className="relative overflow-hidden bg-[#0d0d0f] p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-red-500/20 shadow-2xl">
          {/* Tactical Background Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.02)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
          
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <ShieldAlert size={160} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30">
                <Trash2 className="text-red-500" size={20} />
              </div>
              <h3 className="font-bold text-[18px] sm:text-[20px] text-white font-serif">Destruction Protocol</h3>
            </div>
            <p className="text-[12px] sm:text-[13px] text-white/60 mb-8 max-w-lg leading-relaxed">
              Purging this event will permanently wipe all S3 originals, delete AWS Rekognition collections, 
              and remove all PostgreSQL database records. <strong className="text-red-400">This action is irreversible.</strong>
            </p>
            
            <div className="space-y-5 w-full sm:max-w-md bg-white/5 p-5 sm:p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-mono uppercase text-white/50 tracking-widest flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span>Enter Authorization Code:</span> 
                  <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded tracking-widest">{eventData.passcode}</span>
                </label>
                <input 
                  type="text" 
                  value={confirmText} 
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Awaiting input..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-mono text-white focus:border-red-500/50 focus:bg-red-500/5 outline-none transition-all placeholder:text-white/20"
                />
              </div>
              <button 
                onClick={handleDelete} 
                disabled={!isDeleteReady || isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-3 px-6 py-3.5 sm:py-4 rounded-xl text-[11px] sm:text-[12px] font-bold uppercase tracking-widest transition-all duration-300",
                  isDeleteReady 
                    ? "bg-red-600 text-white hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 border border-red-500" 
                    : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                )}
              >
                {isPending ? <Loader2 className="animate-spin" size={16} /> : <ShieldAlert size={16} />}
                {isPending ? "Executing Purge..." : "Confirm Destruction"}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatusIndicator({ label, status, sub }: { label: string; status: string; sub: string }) {
  const isOnline = status === "online";
  return (
    <div className="group p-4 sm:p-5 rounded-2xl border border-[#dbd8cf]/50 bg-[#f5f4f0]/50 flex items-center gap-4 transition-all hover:bg-white hover:shadow-sm hover:border-[#c94a20]/20">
      <div className="relative shrink-0">
        <div className={cn(
          "w-3 h-3 rounded-full relative z-10", 
          isOnline ? "bg-green-500" : "bg-red-500"
        )} />
        {isOnline && (
          <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-40" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-[12px] font-bold text-[#0e0e0f] uppercase tracking-tight truncate">{label}</p>
        <p className="text-[9px] sm:text-[10px] font-mono text-[#5a5a64] uppercase tracking-widest leading-none mt-1 truncate">{sub}</p>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, pulse }: { icon: any; label: string; value: number; pulse?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 sm:p-5 bg-[#f5f4f0] rounded-2xl border border-[#dbd8cf]/30 transition-all hover:bg-white group hover:shadow-sm">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-8 h-8 rounded-full bg-white border border-[#dbd8cf] flex items-center justify-center text-[#5a5a64] group-hover:text-[#c94a20] group-hover:border-[#c94a20]/30 transition-colors shadow-sm">
          {pulse ? (
            <div className="w-2 h-2 bg-[#c94a20] rounded-full animate-pulse" />
          ) : (
            icon
          )}
        </div>
        <span className="text-[12px] sm:text-[13px] font-bold text-[#0e0e0f]">{label}</span>
      </div>
      <span className="text-[16px] sm:text-[18px] font-mono font-bold text-[#0e0e0f] bg-white px-3 py-1 rounded-lg border border-[#dbd8cf]/50 shadow-inner">
        {value.toLocaleString()}
      </span>
    </div>
  );
}