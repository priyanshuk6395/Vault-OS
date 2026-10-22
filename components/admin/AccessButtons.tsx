"use client";

import { useState } from "react";
import { RefreshCw, Copy, Check, Link as LinkIcon } from "lucide-react";
import { rotateEventPasscode } from "@/lib/actions/event-actions";
import { toast } from "sonner"; // Using Sonner for premium feedback

interface AccessButtonProps {
  eventId: string;
  passcode: string;
  guestLink: string;
}

export default function AccessButtons({ eventId, passcode: initialPasscode, guestLink }: AccessButtonProps) {
  const [isRotating, setIsRotating] = useState(false);
  const [passcode, setPasscode] = useState(initialPasscode);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleRotate = async () => {
    if (!confirm("Invalidate current passcode? All active guests will be required to re-authenticate.")) return;
    
    setIsRotating(true);
    const toastId = toast.loading("Rotating cryptographic keys...");
    
    const result = await rotateEventPasscode(eventId);
    
    if (result.success) {
      setPasscode(result.newPasscode ?? initialPasscode);
      toast.success("Passcode Rotated", { id: toastId, description: "New access key is now active." });
    } else {
      toast.error("Rotation Failed", { id: toastId });
    }
    
    setIsRotating(false);
  };

  const handleCopyPasscode = () => {
    if (!passcode) return;
    navigator.clipboard.writeText(passcode);
    setCopiedPasscode(true);
    toast.success("Passcode copied to clipboard");
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!passcode) return;
    // Copies a beautifully formatted string with both link and passcode
    const shareText = `Here is your Vault Access Link:\n${guestLink}\n\nPasscode: ${passcode}`;
    navigator.clipboard.writeText(shareText);
    setCopiedLink(true);
    toast.success("Shareable Link Copied", { description: "Link and passcode copied to clipboard." });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Primary Action: Copy Full Link */}
      <button 
        onClick={handleCopyLink}
        className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg active:scale-95"
      >
        {copiedLink ? <Check size={16} /> : <LinkIcon size={16} />}
        {copiedLink ? "Link Copied!" : "Copy Shareable Link"}
      </button>

      <div className="flex gap-3">
        {/* Secondary Action: Rotate */}
        <button 
          onClick={handleRotate}
          disabled={isRotating}
          className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-subtle hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRotating ? "animate-spin" : ""} />
          Rotate
        </button>
        
        {/* Secondary Action: Copy Passcode Only */}
        <button 
          onClick={handleCopyPasscode}
          className="flex-1 bg-card border border-border text-foreground py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-subtle transition-all"
        >
          {copiedPasscode ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          Passcode
        </button>
      </div>
    </div>
  );
}