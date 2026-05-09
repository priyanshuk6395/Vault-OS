"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Terminal, ShieldAlert, Cpu, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export default function FirstEventPage() {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name || !passcode) {
      toast.error("Initialization Failed", {
        description: "Please provide both an instance title and a passcode.",
      });
      return;
    }

    setIsInitializing(true);
    
    const toastId = toast.loading("Provisioning Infrastructure...", {
      description: "Creating S3 buckets and Rekognition collections.",
    });

    try {
      const res = await fetch("/api/admin/events/create", {
        method: "POST",
        body: JSON.stringify({ name, passcode: passcode.toUpperCase() }),
        headers: { "Content-Type": "application/json" }
      });

      if (res.ok) {
        const data = await res.json();
        
        toast.success("Vault Initialized", {
          id: toastId,
          description: `${name.toUpperCase()} is now live on AP-SOUTH-1.`,
        });

        setTimeout(() => {
          router.push(`/admin/${data.id}/overview`);
        }, 1500);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to deploy assets.");
      }
    } catch (error: any) {
      setIsInitializing(false);
      toast.error("Deployment Error", {
        id: toastId,
        description: error.message,
      });
    }
  };

  return (
    <main className="min-h-[100dvh] relative bg-[#0d0d0f] flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans selection:bg-[#c94a20]/30 overflow-hidden">
      
      {/* Navigation Escape Hatch */}
      <div className="absolute top-6 left-4 sm:left-8 z-50 animate-in fade-in duration-1000">
        <Link 
          href="/admin"
          className="group flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-white/40 uppercase tracking-widest hover:text-white transition-colors"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Abort & Return
        </Link>
      </div>

      {/* Background Decorative Patterns */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#c94a20 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
           
      {/* Cinematic Glowing Orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#c94a20]/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none mix-blend-screen z-0" />

      <div className="max-w-xl w-full relative z-10 my-12">
        <div className="mb-8 sm:mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c94a20]/10 border border-[#c94a20]/20 text-[#c94a20] text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] mb-4 sm:mb-6">
            <Terminal size={12} />
            System Provisioning Required
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight mb-3 sm:mb-4">
            Initialize New Vault
          </h1>
          <p className="text-white/40 text-xs sm:text-sm max-w-xs sm:max-w-sm mx-auto leading-relaxed">
            Provision S3 storage and AWS Rekognition face collections for your media instance.
          </p>
        </div>
        
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 backdrop-blur-md shadow-2xl animate-in zoom-in-95 duration-1000">
          <div className="space-y-6 sm:space-y-8">
            
            {/* EVENT NAME INPUT */}
            <div className="space-y-2">
              <label className="text-[9px] sm:text-[10px] font-mono uppercase text-white/30 tracking-widest ml-1">Instance Title</label>
              <div className="relative group">
                <input 
                  placeholder="e.g. SONAMARG_EXPEDITION_2026" 
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl text-white placeholder:text-white/10 focus:border-[#c94a20]/50 outline-none transition-all font-mono text-xs sm:text-sm uppercase tracking-wider"
                  onChange={(e) => setName(e.target.value)}
                />
                <Cpu size={18} className="absolute right-4 sm:right-5 top-4 sm:top-5 text-white/10 group-focus-within:text-[#c94a20] transition-colors" />
              </div>
            </div>

            {/* PASSCODE INPUT */}
            <div className="space-y-2">
              <label className="text-[9px] sm:text-[10px] font-mono uppercase text-white/30 tracking-widest ml-1">Access Protocol (Passcode)</label>
              <div className="relative group">
                <input 
                  type="text"
                  maxLength={12}
                  placeholder="MIN_8_CHARS" 
                  className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl text-white placeholder:text-white/10 focus:border-[#c94a20]/50 outline-none transition-all font-mono text-xs sm:text-sm uppercase tracking-widest"
                  onChange={(e) => setPasscode(e.target.value)}
                />
                <ShieldAlert size={18} className="absolute right-4 sm:right-5 top-4 sm:top-5 text-white/10 group-focus-within:text-[#c94a20] transition-colors" />
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button 
                onClick={handleCreate}
                disabled={!name || passcode.length < 4 || isInitializing}
                className={cn(
                  "w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] transition-all duration-500 flex items-center justify-center gap-3",
                  isInitializing 
                    ? "bg-white/5 text-white/20 cursor-wait"
                    : "bg-[#c94a20] text-white hover:bg-[#e05325] hover:scale-[1.01] active:scale-[0.98] shadow-xl shadow-[#c94a20]/20"
                )}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deploying Assets...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Initialize Instance
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 opacity-30">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />
              <span className="text-[8.5px] sm:text-[9px] font-mono uppercase truncate">AWS_REKOGNITION_READY</span>
            </div>
            <span className="text-[8.5px] sm:text-[9px] font-mono uppercase text-left sm:text-right">Node: AP_SOUTH_1</span>
          </div>
        </div>
      </div>
    </main>
  );
}