"use client";

import { useState } from "react";
import { verifyGuestAccess } from "@/lib/actions/auth-actions";
import { toast } from "sonner";
import { Loader2, ShieldCheck, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasscodeGateProps {
  eventId: string;
  eventTitle?: string;
  onVerified?: () => void;
}

export default function PasscodeGate({ eventId, eventTitle, onVerified }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    const result = await verifyGuestAccess(eventId, passcode);

    if (result.success) {
      toast.success("Access Granted", {
        description: "Decryption successful. Welcome to the Vault.",
        icon: <ShieldCheck className="w-4 h-4 text-green-500" />
      });
      if (typeof onVerified === "function") onVerified();
      // Note: If using Server Actions/Cookies, page will likely reload via router.refresh() 
      // or redirect in the parent before this state matters much.
    } else {
      setLoading(false);
      setPasscode(""); // Clear on fail for UX
      toast.error("Access Denied", {
        description: "Invalid protocol passcode.",
      });
    }
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 p-8 sm:p-12 rounded-[40px] backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col items-center">
      
      <div className="w-16 h-16 bg-[#c94a20]/10 border border-[#c94a20]/20 rounded-2xl text-[#c94a20] shadow-[0_0_30px_rgba(201,74,32,0.15)] flex items-center justify-center mb-8">
        <LockKeyhole size={28} />
      </div>
      
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
          {eventTitle || "Locked Vault"}
        </h2>
        <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-2">
          <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
          Awaiting Protocol Passcode
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="relative group">
          <input
            type="text"
            placeholder="ENTER_PASSCODE"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && passcode.length >= 4 && handleVerify()}
            className="w-full bg-black/40 border border-white/10 px-6 py-4 rounded-2xl text-center font-mono text-lg tracking-[0.4em] text-white focus:border-[#c94a20] outline-none transition-all placeholder:text-white/10 placeholder:tracking-[0.2em]"
          />
        </div>
        
        <button
          onClick={handleVerify}
          disabled={loading || passcode.length < 4}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3",
            loading || passcode.length < 4
              ? "bg-white/5 text-white/20 cursor-not-allowed"
              : "bg-[#c94a20] text-white hover:bg-[#e05325] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#c94a20]/20"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck size={16} />}
          {loading ? "Decrypting..." : "Unlock Vault"}
        </button>
      </div>
    </div>
  );
}