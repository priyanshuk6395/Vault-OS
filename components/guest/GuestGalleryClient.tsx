"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle,
  ImagePlus,
  Fingerprint,
  Cpu,
  Search,
  Loader2,
  Download,
} from "lucide-react";
import ImageGrid from "./ImageGrid";
import { cn } from "@/lib/utils";

interface GuestGalleryClientProps {
  matches: any[];
  uploads: any[];
  eventTitle: string;
  eventId: string;
  personId: string;
}

export default function GuestGalleryClient({
  matches,
  uploads,
  eventTitle,
  eventId,
  personId,
}: GuestGalleryClientProps) {
  const [activeTab, setActiveTab] = useState<"matches" | "uploads">("matches");
  const [isDownloading, setIsDownloading] = useState(false);

  const currentData = activeTab === "matches" ? matches : uploads;
  const handleDownloadAll = async () => {
    if (matches.length === 0) return;
    setIsDownloading(true);

    // Trigger the ZIP stream API route
    window.location.href = `/api/events/${eventId}/download-all?personId=${personId}`;

    // Aesthetic delay to match the "Packing" narrative
    setTimeout(() => setIsDownloading(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* 1. TACTICAL TAB NAVIGATION */}
      <div className="flex items-center p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl w-full sm:w-fit mb-10 relative z-20 shadow-2xl">
        <TabButton
          isActive={activeTab === "matches"}
          onClick={() => setActiveTab("matches")}
          icon={<UserCircle size={16} />}
          label="Matches"
          count={matches.length}
        />

        <TabButton
          isActive={activeTab === "uploads"}
          onClick={() => setActiveTab("uploads")}
          icon={<ImagePlus size={16} />}
          label="My Contributions"
          count={uploads.length}
        />
      </div>

      <div className="items-center p-1.5">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading || matches.length === 0}
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-500 border",
            isDownloading
              ? "bg-[#c94a20] border-[#c94a20] text-white animate-pulse"
              : "bg-white/5 border-white/10 text-white hover:bg-white hover:text-black hover:border-white shadow-xl",
          )}
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span>
            {isDownloading
              ? "Packing Archive..."
              : `Download All (${matches.length})`}
          </span>
        </button></div>

      {/* 2. CINEMATIC CONTENT RENDER */}
      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {currentData.length > 0 ? (
              <ImageGrid photos={currentData} />
            ) : (
              /* EMPTY STATE: BIOMETRIC TELEMETRY LOOK */
              <div className="h-[45vh] min-h-[350px] flex flex-col items-center justify-center border border-white/5 rounded-[48px] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md shadow-2xl relative overflow-hidden group">
                {/* Subtle Grid Pattern Overlay */}
                <div
                  className="absolute inset-0 opacity-[0.05] pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(#fff 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />

                <div className="relative mb-8">
                  {/* Outer Pulsing Ring */}
                  <div className="absolute inset-0 rounded-full bg-[#c94a20]/20 animate-ping" />

                  <div className="relative w-20 h-20 bg-[#0d0d0f] border border-[#c94a20]/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(201,74,32,0.2)]">
                    {activeTab === "uploads" ? (
                      <ImagePlus size={32} className="text-[#c94a20]" />
                    ) : (
                      <Fingerprint size={32} className="text-[#c94a20]" />
                    )}
                  </div>
                </div>

                <div className="text-center space-y-3 px-6 relative z-10">
                  <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-tight">
                    {activeTab === "uploads"
                      ? "Archive Empty"
                      : "Identity Scanning"}
                  </h3>

                  <div className="flex items-center justify-center gap-4">
                    <div className="h-[1px] w-8 bg-white/10" />
                    <p className="text-[#c94a20] text-[10px] font-mono uppercase tracking-[0.3em] font-bold">
                      {activeTab === "uploads"
                        ? "Awaiting Data"
                        : "Active Ingestion"}
                    </p>
                    <div className="h-[1px] w-8 bg-white/10" />
                  </div>

                  <p className="text-white/40 text-[11px] font-mono uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                    {activeTab === "uploads"
                      ? "The vault has no records of your uploads. Initialize transfer to begin."
                      : `The biometric engine is cross-referencing ${eventTitle} with your profile.`}
                  </p>
                </div>

                {/* Animated "Scanning" Line for the Match tab */}
                {activeTab === "matches" && (
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "linear",
                    }}
                    className="absolute top-0 left-0 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#c94a20] to-transparent opacity-50"
                  />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: TAB BUTTON ---
function TabButton({ isActive, onClick, icon, label, count }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-500 z-10 group",
        isActive ? "text-white" : "text-white/30 hover:text-white/60",
      )}
    >
      {icon}
      <span>{label}</span>

      {/* Optional Count Badge */}
      {count > 0 && (
        <span
          className={cn(
            "ml-1 text-[9px] px-1.5 py-0.5 rounded-md border transition-colors",
            isActive
              ? "bg-white/10 border-white/20 text-white"
              : "bg-transparent border-white/5 text-white/20",
          )}
        >
          {count}
        </span>
      )}

      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-[#c94a20] rounded-xl shadow-[0_0_20px_rgba(201,74,32,0.4)] z-[-1]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}
