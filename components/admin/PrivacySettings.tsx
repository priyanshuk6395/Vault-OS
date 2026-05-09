"use client";

import { updatePrivacySetting } from "@/lib/actions/privacy-actions";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function PrivacySettings({ event }: { event: any }) {
  const [loading, setLoading] = useState<string | null>(null);

  const toggle = async (field: string, currentValue: boolean) => {
    setLoading(field);
    await updatePrivacySetting(event.id, field, !currentValue);
    setLoading(null);
  };

  return (
    <ul className="text-[13px] space-y-4 text-[#5a5a64] flex-1">
      <li className="flex justify-between items-center border-b border-[#f5f4f0] pb-2">
        <span>Biometric Search</span> 
        <button 
          onClick={() => toggle("biometricSearch", event.biometricSearch)}
          disabled={loading === "biometricSearch"}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
            event.biometricSearch ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
          )}
        >
          {event.biometricSearch ? "ACTIVE" : "DISABLED"}
        </button>
      </li>
      
      <li className="flex justify-between items-center border-b border-[#f5f4f0] pb-2">
        <span>Public Gallery</span> 
        <button 
          onClick={() => toggle("publicGallery", event.publicGallery)}
          disabled={loading === "publicGallery"}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
            event.publicGallery ? "bg-[#c94a20]/10 text-[#c94a20]" : "bg-gray-100 text-gray-400"
          )}
        >
          {event.publicGallery ? "PUBLIC" : "PRIVATE"}
        </button>
      </li>
    </ul>
  );
}