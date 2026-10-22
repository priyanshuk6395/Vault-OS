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
    <ul className="text-[13px] space-y-4 text-muted-foreground flex-1">
      <li className="flex justify-between items-center border-b border-border pb-2">
        <span>Biometric Search</span> 
        <button 
          onClick={() => toggle("biometricSearch", event.biometricSearch)}
          disabled={loading === "biometricSearch"}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
            event.biometricSearch ? "bg-accent-teal/15 text-accent-teal" : "bg-subtle text-muted-foreground"
          )}
        >
          {event.biometricSearch ? "ACTIVE" : "DISABLED"}
        </button>
      </li>
      
      <li className="flex justify-between items-center border-b border-border pb-2">
        <span>Public Gallery</span> 
        <button 
          onClick={() => toggle("publicGallery", event.publicGallery)}
          disabled={loading === "publicGallery"}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
            event.publicGallery ? "bg-primary/10 text-primary" : "bg-subtle text-muted-foreground"
          )}
        >
          {event.publicGallery ? "PUBLIC" : "PRIVATE"}
        </button>
      </li>
    </ul>
  );
}