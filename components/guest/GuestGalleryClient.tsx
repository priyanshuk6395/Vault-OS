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
      <div className="flex items-center p-1.5 bg-card border border-border rounded-lg w-full sm:w-fit mb-10 relative z-20 shadow-sm">
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
              ? "bg-primary border-primary text-primary-foreground animate-pulse"
              : "bg-card border-border text-foreground hover:bg-subtle shadow-sm",
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
              <div className="h-[45vh] min-h-[350px] flex flex-col items-center justify-center border border-border rounded-xl bg-linear-to-b from-subtle to-background shadow-sm relative overflow-hidden group">
                {/* Subtle Grid Pattern Overlay */}
                <div
                  className="absolute inset-0 opacity-[0.05] pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(var(--foreground) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />

                <div className="relative mb-8">
                  {/* Outer Pulsing Ring */}
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />

                  <div className="relative w-20 h-20 bg-card border border-primary/30 rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                    {activeTab === "uploads" ? (
                      <ImagePlus size={32} className="text-primary" />
                    ) : (
                      <Fingerprint size={32} className="text-primary" />
                    )}
                  </div>
                </div>

                <div className="text-center space-y-3 px-6 relative z-10">
                  <h3 className="font-serif text-2xl sm:text-3xl text-foreground font-bold tracking-tight">
                    {activeTab === "uploads"
                      ? "Archive Empty"
                      : "Identity Scanning"}
                  </h3>

                  <div className="flex items-center justify-center gap-4">
                    <div className="h-[1px] w-8 bg-border" />
                    <p className="text-primary text-[10px] font-mono uppercase tracking-[0.3em] font-bold">
                      {activeTab === "uploads"
                        ? "Awaiting Data"
                        : "Active Ingestion"}
                    </p>
                    <div className="h-[1px] w-8 bg-border" />
                  </div>

                  <p className="text-muted-foreground text-[11px] font-mono uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
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
                    className="absolute top-0 left-0 w-1/2 h-[1px] bg-linear-to-r from-transparent via-primary to-transparent opacity-50"
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
        isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
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
              ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
              : "bg-transparent border-border text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}

      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-primary rounded-md shadow-lg shadow-primary/20 z-[-1]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}
