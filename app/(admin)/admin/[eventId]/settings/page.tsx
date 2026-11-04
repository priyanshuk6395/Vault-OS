"use client";

import { useState, useEffect, useTransition } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2, Loader2, ShieldAlert,
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
  const [eventData, setEventData] = useState<Awaited<ReturnType<typeof getEventSettings>>>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    // Initial data synchronization
    getEventSettings(eventId).then(setEventData);
  }, [eventId]);

  const isDeleteReady = confirmText.trim().length >= 4;

  const handleDelete = async () => {
    if (!isDeleteReady) return;
    
    const toastId = toast.loading("Initiating Purge Protocol...");
    
    startTransition(async () => {
      const result = await deleteEvent(eventId, confirmText);
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
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-subtle rounded" />
          <div className="h-8 w-64 bg-border rounded-lg" />
          <div className="h-3 w-40 bg-subtle rounded" />
        </div>
        <div className="h-8 w-24 bg-subtle rounded-full self-start sm:self-end" />
      </div>
      <div className="h-[200px] w-full bg-card rounded-xl border border-border" />
      <div className="h-[250px] w-full bg-card rounded-xl border border-border" />
      <div className="h-[300px] w-full bg-card rounded-xl border border-red-500/10" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ENTERPRISE HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Settings size={12} /> System Config
            </span>
          </div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <span className="truncate max-w-[200px] sm:max-w-md">{eventData.title || "Vault"}</span>
            <span className="text-border font-sans font-normal text-[22px] shrink-0">/</span> 
            <span className="text-muted-foreground font-sans font-normal text-[22px] shrink-0">Settings</span>
          </h2>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1 font-medium">
            Node ID: <span className="font-mono text-primary uppercase font-bold">{eventId.slice(0, 12)}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-teal/10 border border-accent-teal/20 rounded-lg shadow-sm self-start sm:self-auto shrink-0">
          <div className="w-1.5 h-1.5 bg-accent-teal rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-accent-teal uppercase tracking-widest">System Live</span>
        </div>
      </header>

      <div className="space-y-6 sm:space-y-8">
        
        {/* 1. CONNECTIVITY DIAGNOSTICS */}
        <section className="bg-card border border-border p-6 sm:p-8 rounded-xl shadow-sm">
          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="p-3 bg-accent-teal/10 rounded-lg border border-accent-teal/20">
              <Activity className="text-accent-teal" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] sm:text-[18px] text-foreground font-serif">Service Connectivity</h3>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-1">Real-time Infrastructure Status</p>
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
        <section className="bg-card border border-border p-6 sm:p-8 rounded-xl shadow-sm">
          <div className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="p-3 bg-accent-amber/10 rounded-lg border border-accent-amber/20">
              <Database className="text-accent-amber" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] sm:text-[18px] text-foreground font-serif">Audit Metrics</h3>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-1">Metadata Synchronization</p>
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
        <section className="relative overflow-hidden bg-card text-card-foreground p-6 sm:p-8 rounded-xl border border-red-500/20 shadow-xl">
          {/* Tactical Background Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.02)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
          
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <ShieldAlert size={160} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                <Trash2 className="text-red-500" size={20} />
              </div>
              <h3 className="font-bold text-[18px] sm:text-[20px] text-card-foreground font-serif">Destruction Protocol</h3>
            </div>
            <p className="text-[12px] sm:text-[13px] text-muted-foreground mb-8 max-w-lg leading-relaxed">
              Purging this event will permanently wipe all S3 originals, delete AWS Rekognition collections, 
              and remove all PostgreSQL database records. <strong className="text-red-400">This action is irreversible.</strong>
            </p>
            
            <div className="space-y-5 w-full sm:max-w-md bg-background p-5 sm:p-6 rounded-lg border border-border">
              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-mono uppercase text-muted-foreground tracking-widest flex flex-col sm:flex-row gap-1 sm:gap-2">
                  <span>Confirm with the current guest passcode:</span>
                </label>
                <input 
                  type="text" 
                  value={confirmText} 
                  onChange={(e) => setConfirmText(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  placeholder="Enter six-digit passcode"
                  className="w-full bg-card border border-input rounded-md px-4 py-3 text-[13px] font-mono text-foreground focus:border-red-500/50 focus:bg-red-500/5 outline-none transition-all placeholder:text-muted-foreground"
                />
              </div>
              <button 
                onClick={handleDelete} 
                disabled={!isDeleteReady || isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-3 px-6 py-3.5 sm:py-4 rounded-xl text-[11px] sm:text-[12px] font-bold uppercase tracking-widest transition-all duration-300",
                  isDeleteReady 
                    ? "bg-red-600 text-white hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 border border-red-500" 
                    : "bg-subtle text-muted-foreground cursor-not-allowed border border-border"
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
    <div className="group p-4 sm:p-5 rounded-lg border border-border bg-subtle flex items-center gap-4 transition-all hover:bg-card hover:shadow-sm hover:border-primary/20">
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
        <p className="text-[11px] sm:text-[12px] font-bold text-foreground uppercase tracking-tight truncate">{label}</p>
        <p className="text-[9px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none mt-1 truncate">{sub}</p>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, pulse }: { icon: ReactNode; label: string; value: number; pulse?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 sm:p-5 bg-subtle rounded-lg border border-border transition-all hover:bg-card group hover:shadow-sm">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-colors shadow-sm">
          {pulse ? (
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          ) : (
            icon
          )}
        </div>
        <span className="text-[12px] sm:text-[13px] font-bold text-foreground">{label}</span>
      </div>
      <span className="text-[16px] sm:text-[18px] font-mono font-bold text-foreground bg-card px-3 py-1 rounded-md border border-border shadow-inner">
        {value.toLocaleString()}
      </span>
    </div>
  );
}