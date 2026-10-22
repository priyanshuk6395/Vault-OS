"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import GuestUploadDialog from "./GuestUploadDialog";

export default function GuestUploadTrigger({ eventId, personId }: { eventId: string, personId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="group bg-primary text-primary-foreground px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-lg active:scale-95"
      >
        <Upload size={18} className="transition-transform group-hover:-translate-y-1" />
        Contribute Photos
      </button>

      <GuestUploadDialog 
        eventId={eventId} 
        personId={personId}
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}