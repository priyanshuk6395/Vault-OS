"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  X,
  Maximize2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Sub-component for individual images ---
function GridItem({ photo, onClick }: { photo: any; onClick: () => void }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <motion.div
      layoutId={`photo-container-${photo.id}`}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative group break-inside-avoid mb-6 rounded-[24px] overflow-hidden cursor-zoom-in bg-white/5 border border-white/10 shadow-xl hover:shadow-[#c94a20]/20 transition-all duration-500"
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#1a1a1c] flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-6 h-6 text-[#c94a20] animate-spin mb-2" />
          <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">
            Decrypting...
          </span>
        </div>
      )}

      <img
        src={photo.signedUrl}
        alt={photo.sourceFilename || "Vault Memory"}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-auto object-cover transition-all duration-1000 ease-out will-change-transform",
          isLoaded
            ? "opacity-100 blur-0 scale-100"
            : "opacity-0 blur-2xl scale-110",
          "group-hover:scale-105",
        )}
      />

      {/* Action Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] font-mono text-white/60 truncate max-w-[120px]">
            {photo.sourceFilename?.split(".")[0]}
          </span>
          <div className="p-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20">
            <Maximize2 size={14} className="text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Main Grid Component ---
export default function ImageGrid({ photos }: { photos: any[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentIndex = photos.findIndex((p) => p.id === selectedPhoto?.id);
  const hasNext = currentIndex >= 0 && currentIndex < photos.length - 1;
  const hasPrev = currentIndex > 0;

  const closeLightbox = useCallback(() => {
    setSelectedPhoto(null);
    setLightboxLoaded(false);
    setDirection(0);
  }, []);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setDirection(1);
      setLightboxLoaded(false);
      setSelectedPhoto(photos[currentIndex + 1]);
    }
  }, [currentIndex, hasNext, photos]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setDirection(-1);
      setLightboxLoaded(false);
      setSelectedPhoto(photos[currentIndex - 1]);
    }
  }, [currentIndex, hasPrev, photos]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPhoto) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, closeLightbox, handleNext, handlePrev]);

  const handleDownload = async (
    storageKey: string,
    originalFilename?: string,
  ) => {
    try {
      // 1. Get the pre-signed URL from your backend
      const res = await fetch(`/api/upload/download-url?key=${storageKey}`);
      const { url } = await res.json();

      // 2. Fetch the file into the browser's local memory (Blob)
      // This is the magic step that bypasses AWS cross-origin naming blocks
      const imageResponse = await fetch(url);
      const blob = await imageResponse.blob();
      const localBlobUrl = window.URL.createObjectURL(blob);

      // 3. Determine the name (use provided name, or extract from key)
      const downloadName =
        originalFilename || storageKey.split("/").pop() || "vault_asset.jpg";

      // 4. Create an invisible link and strictly force the download
      const link = document.createElement("a");
      link.href = localBlobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();

      // 5. Clean up the DOM and Memory
      document.body.removeChild(link);
      window.URL.revokeObjectURL(localBlobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const lightboxContent = (
    <AnimatePresence initial={false} custom={direction}>
      {selectedPhoto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center w-screen h-[100dvh] overflow-hidden touch-none">
          {/* Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
            className="absolute inset-0 bg-black/98 backdrop-blur-2xl"
          />

          {/* Nav Buttons (Desktop) */}
          <div className="hidden md:contents">
            {hasPrev && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-8 z-[100] p-5 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all hover:scale-110 active:scale-95 group"
              >
                <ChevronLeft size={32} />
              </button>
            )}
            {hasNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-8 z-[100] p-5 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all hover:scale-110 active:scale-95 group"
              >
                <ChevronRight size={32} />
              </button>
            )}
          </div>

          {/* Swipeable Content */}
          <motion.div
            key={selectedPhoto.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x > 100 || velocity.x > 500) handlePrev();
              else if (offset.x < -100 || velocity.x < -500) handleNext();
            }}
            className="relative z-10 w-full h-full flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
          >
            {!lightboxLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-[#c94a20] animate-spin" />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em]">
                  Enhancing...
                </span>
              </div>
            )}
            <img
              src={selectedPhoto.signedUrl}
              alt="Memory"
              onLoad={() => setLightboxLoaded(true)}
              className={cn(
                "max-w-[95vw] max-h-[80vh] object-contain rounded-xl shadow-2xl transition-all duration-500",
                lightboxLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
              )}
              draggable={false}
            />
          </motion.div>

          {/* Footer Controls */}
          <div className="absolute bottom-10 left-0 w-full px-6 flex flex-col items-center gap-6 z-[100] pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedPhoto.storageKey, selectedPhoto.sourceFilename);
                }}
                className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-widest text-[11px] transition-all hover:bg-[#c94a20] hover:text-white shadow-2xl active:scale-95"
              >
                <Download size={18} /> Save Memory
              </button>
              <button
                onClick={closeLightbox}
                className="p-4 bg-white/10 text-white rounded-full hover:bg-red-500 transition-all border border-white/10 backdrop-blur-xl active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-white/40 text-[10px] font-mono uppercase tracking-[0.2em]">
              Index: {currentIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="pb-20">
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {photos.map((photo) => (
          <GridItem
            key={photo.id}
            photo={photo}
            onClick={() => setSelectedPhoto(photo)}
          />
        ))}
      </div>
      {mounted && createPortal(lightboxContent, document.body)}
    </div>
  );
}
