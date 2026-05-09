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

export default function AccessButtons({ eventId, passcode, guestLink }: AccessButtonProps) {
  const [isRotating, setIsRotating] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleRotate = async () => {
    if (!confirm("Invalidate current passcode? All active guests will be required to re-authenticate.")) return;
    
    setIsRotating(true);
    const toastId = toast.loading("Rotating cryptographic keys...");
    
    const result = await rotateEventPasscode(eventId);
    
    if (result.success) {
      toast.success("Passcode Rotated", { id: toastId, description: "New access key is now active." });
    } else {
      toast.error("Rotation Failed", { id: toastId });
    }
    
    setIsRotating(false);
  };

  const handleCopyPasscode = () => {
    navigator.clipboard.writeText(passcode);
    setCopiedPasscode(true);
    toast.success("Passcode copied to clipboard");
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  const handleCopyLink = () => {
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
        className="w-full bg-[#0e0e0f] text-white py-3.5 rounded-xl text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#c94a20] transition-all shadow-lg active:scale-95"
      >
        {copiedLink ? <Check size={16} /> : <LinkIcon size={16} />}
        {copiedLink ? "Link Copied!" : "Copy Shareable Link"}
      </button>

      <div className="flex gap-3">
        {/* Secondary Action: Rotate */}
        <button 
          onClick={handleRotate}
          disabled={isRotating}
          className="flex-1 bg-white border border-[#dbd8cf] text-[#0e0e0f] py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#f5f4f0] hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRotating ? "animate-spin" : ""} />
          Rotate
        </button>
        
        {/* Secondary Action: Copy Passcode Only */}
        <button 
          onClick={handleCopyPasscode}
          className="flex-1 bg-white border border-[#dbd8cf] text-[#0e0e0f] py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#f5f4f0] transition-all"
        >
          {copiedPasscode ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          Passcode
        </button>
      </div>
    </div>
  );
}