"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion"; // <-- Added AnimatePresence
import {
  X,
  ExternalLink,
  Trash2,
  Loader2,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// --- Sub-component for individual grid images ---
function AdminGridItem({ asset, onClick, onDelete, isDeleting, isEditing, isSelected, onSelect }: any) {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      onSelect(asset.id);
    } else {
      onClick();
    }
  };

  return (
    <motion.div
      layoutId={`admin-asset-${asset.id}`}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onClick={handleClick}
      className={cn(
        "group bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all relative flex flex-col",
        isSelected ? "border-[#c94a20] shadow-[0_0_0_2px_#c94a20] scale-[0.98]" : "border-[#dbd8cf] hover:shadow-xl hover:shadow-[#c94a20]/10"
      )}
    >
      <div className="aspect-[4/3] bg-[#eceae4] relative flex items-center justify-center overflow-hidden">
        
        {/* Bulk Select Overlay Checkbox */}
        {isEditing && (
          <div className="absolute top-3 left-3 z-40">
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300", 
              isSelected ? "bg-[#c94a20] border-[#c94a20] text-white" : "bg-black/30 border-white/70 backdrop-blur-sm"
            )}>
              {isSelected && <Check size={14} strokeWidth={3} />}
            </div>
          </div>
        )}
        {/* Loading Skeleton */}
        {!isLoaded && asset.url && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#f5f4f0] to-[#eceae4] flex items-center justify-center animate-pulse z-0">
            <Loader2 className="w-5 h-5 text-[#c8b89a] animate-spin" />
          </div>
        )}

        {asset.url ? (
          <img
            src={asset.url}
            alt={asset.sourceFilename || "Event Photo"}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            className={cn(
              "w-full h-full object-cover transition-all duration-700 ease-out z-10",
              isLoaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-xl scale-110",
              "group-hover:scale-105"
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#c8b89a] z-10">
            <ImageIcon size={24} />
            <span className="text-[10px] font-mono uppercase">No Preview</span>
          </div>
        )}

        {/* Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(asset.id);
          }}
          disabled={isDeleting}
          className="absolute top-3 right-3 p-2.5 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 active:scale-95 shadow-lg z-30"
        >
          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      <div className="p-3 bg-white z-10 border-t border-[#f5f4f0] flex-1 flex flex-col justify-between">
        <div className="text-[11.5px] font-bold truncate text-[#0e0e0f] mb-1 font-serif">
          {asset.sourceFilename}
        </div>
        
        {/* Uploader Name Tag */}
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#5a5a64] uppercase tracking-widest mb-2">
          <User size={10} className="text-[#c8b89a] shrink-0" /> 
          <span className="truncate">{asset.uploader?.name || "System Ingestion"}</span>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase tracking-tighter",
            asset.status === "processed" ? "bg-[#e6f5ee] text-[#2a7a4f]" : "bg-[#f5f4f0] text-[#5a5a64]"
          )}>
            AI: {asset.status === "processed" ? "DONE" : asset.status}
          </span>
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase tracking-tighter",
            asset.moderationState === "approved" ? "bg-[#e6f5ee] text-[#2a7a4f]" : "bg-[#fdf2e0] text-[#a06010]"
          )}>
            MOD: {asset.moderationState === "approved" ? "OK" : "PENDING"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// --- Main Component ---
export default function MediaGrid({
  assets,
  onDelete,
  isEditing,
  selectedIds,
  onSelect
}: {
  assets: any[];
  onDelete: (id: string) => Promise<void>;
  isEditing?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
}) {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  
  // NEW: State to track which direction the gallery is sliding
  const [direction, setDirection] = useState(0);

  // --- GALLERY NAVIGATION LOGIC ---
  const currentIndex = assets.findIndex((a) => a.id === selectedAsset?.id);
  const hasNext = currentIndex >= 0 && currentIndex < assets.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = useCallback(() => {
    if (hasNext) {
      setDirection(1); // Sliding Right-to-Left
      setLightboxLoaded(false);
      setSelectedAsset(assets[currentIndex + 1]);
    }
  }, [currentIndex, hasNext, assets]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setDirection(-1); // Sliding Left-to-Right
      setLightboxLoaded(false);
      setSelectedAsset(assets[currentIndex - 1]);
    }
  }, [currentIndex, hasPrev, assets]);

  // --- KEYBOARD LISTENERS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedAsset) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAsset, handleNext, handlePrev]);

  const handleDeleteClick = async (id: string) => {
    setIsDeleting(id);
    await onDelete(id);
    setIsDeleting(null);
    if (selectedAsset?.id === id) {
      setSelectedAsset(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-2">
        {assets.map((asset) => (
          <AdminGridItem 
            key={asset.id} 
            asset={asset} 
            isDeleting={isDeleting === asset.id}
            isEditing={isEditing}
            isSelected={selectedIds?.has(asset.id)}
            onSelect={onSelect}
            onClick={() => {
              setLightboxLoaded(false);
              setDirection(0); // Reset direction on first open
              setSelectedAsset(asset);
            }} 
            onDelete={handleDeleteClick} 
          />
        ))}
      </div>

      <Dialog
        open={!!selectedAsset}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedAsset(null);
        }}
      >
        <DialogContent className="w-[100vw] sm:max-w-[95vw] h-[100dvh] sm:h-[95vh] p-0 overflow-hidden bg-black/95 border-none shadow-2xl flex items-center justify-center sm:rounded-[32px] duration-500">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>

          <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden touch-none">
            
            {/* Top Bar Navigation */}
            <div className="absolute top-0 left-0 w-full p-4 sm:p-6 z-50 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-[10px] font-mono tracking-widest uppercase pointer-events-auto">
                {currentIndex + 1} / {assets.length}
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-2.5 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors border border-white/10 hover:border-transparent pointer-events-auto"
              >
                <X size={20} />
              </button>
            </div>

            {/* Side Navigation Buttons (Desktop) */}
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 z-50 p-3 sm:p-4 bg-white/5 hover:bg-white/20 text-white rounded-full backdrop-blur-xl border border-white/10 transition-all hover:scale-110 active:scale-95 group hidden sm:block"
              >
                <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              </button>
            )}

            {hasNext && (
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 z-50 p-3 sm:p-4 bg-white/5 hover:bg-white/20 text-white rounded-full backdrop-blur-xl border border-white/10 transition-all hover:scale-110 active:scale-95 group hidden sm:block"
              >
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {/* SWIPEABLE IMAGE CONTAINER */}
            <div className="relative flex-1 w-full min-h-[400px] flex items-center justify-center p-4">
              
              {!lightboxLoaded && selectedAsset?.url && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0">
                  <Loader2 className="animate-spin text-[#c94a20]" size={32} />
                  <span className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Decrypting Asset...</span>
                </div>
              )}
              
              <AnimatePresence initial={false} custom={direction} mode="wait">
                {selectedAsset?.url ? (
                  <motion.div
                    key={selectedAsset.id}
                    custom={direction}
                    // Cinematic Slide physics
                    initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    // Swipe Gestures Enablement
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.8} // Smooth rubber-band effect
                    onDragEnd={(e, { offset, velocity }) => {
                      // Trigger next/prev if swiped far enough OR swiped fast enough
                      const swipe = offset.x;
                      if (swipe < -50 || velocity.x < -500) {
                        handleNext();
                      } else if (swipe > 50 || velocity.x > 500) {
                        handlePrev();
                      }
                    }}
                    className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing p-4"
                    onClick={(e) => {
                      // Fallback: Still allows tapping the far edges of the screen
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      if (x < rect.width / 3) handlePrev();
                      else if (x > (rect.width * 2) / 3) handleNext();
                    }}
                  >
                    <img
                      src={selectedAsset.url}
                      className={cn(
                        "max-h-[85vh] max-w-full object-contain select-none rounded-xl shadow-2xl transition-opacity duration-300 z-10 pointer-events-none",
                        lightboxLoaded ? "opacity-100" : "opacity-0"
                      )}
                      onLoad={() => setLightboxLoaded(true)}
                      alt="Full preview"
                    />
                  </motion.div>
                ) : (
                  <div className="text-[#c8b89a] flex flex-col items-center gap-2">
                    <ImageIcon size={48} opacity={0.5} />
                    <span className="text-[12px] font-mono uppercase">Asset Unavailable</span>
                  </div>
                )}
              </AnimatePresence>

            </div>

            {/* Bottom Info Bar */}
            <div className="w-full p-6 sm:p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col sm:flex-row sm:items-end justify-between gap-6 z-20 pointer-events-none">
              <div className="space-y-2 pointer-events-auto">
                <p className="text-white text-[16px] sm:text-[18px] font-serif font-bold truncate max-w-[250px] sm:max-w-md lg:max-w-2xl">
                  {selectedAsset?.sourceFilename}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white/40 text-[10px] font-mono uppercase tracking-widest bg-white/10 px-2 py-1 rounded">
                    ID: {selectedAsset?.id.slice(0, 8)}
                  </span>
                  
                  <span className="text-white/40 text-[10px] font-mono uppercase tracking-widest bg-white/10 px-2 py-1 rounded flex items-center gap-1.5">
                    <User size={10} /> {selectedAsset?.uploader?.name || "System"}
                  </span>

                  <span className={cn(
                    "text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded font-bold",
                    selectedAsset?.moderationState === "approved" ? "text-[#2a7a4f] bg-[#e6f5ee]/20" : "text-[#a06010] bg-[#fdf2e0]/20"
                  )}>
                    MOD: {selectedAsset?.moderationState}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 pointer-events-auto">
                <button
                  onClick={() => window.open(selectedAsset?.url, "_blank")}
                  className="flex-1 sm:flex-none justify-center px-5 py-3 bg-white/10 hover:bg-white hover:text-black text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <ExternalLink size={14} /> <span className="hidden sm:inline">Open Original</span>
                </button>
                <button
                  onClick={() => handleDeleteClick(selectedAsset?.id)}
                  disabled={isDeleting === selectedAsset?.id}
                  className="flex-1 sm:flex-none justify-center px-5 py-3 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  {isDeleting === selectedAsset?.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}