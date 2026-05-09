"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, X, SkipForward, Loader2, Maximize2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function FaceReviewClient({ queue: initialQueue }: { queue: any[] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | "up">("right");

  const currentItem = queue[currentIndex];

  // 1. KEYBOARD SHORTCUTS (Power User UX)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "a") handleAction('confirm', "right");
      if (e.key === "Escape" || e.key === "r") handleAction('reject', "left");
      if (e.key === "s") handleAction('skip', "up");
      if (e.key === "v") setShowFullImage(prev => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  const handleAction = async (action: 'confirm' | 'skip' | 'reject', direction: "left" | "right" | "up") => {
    if (isProcessing || currentIndex >= queue.length) return;
    
    setIsProcessing(true);
    setExitDirection(direction);
    
    const detectionId = currentItem.faceDetections[0].id;
    const toastId = toast.loading(`Executing ${action.toUpperCase()} protocol...`);

    try {
      // ACTUAL API CALL
      const res = await fetch(`/api/events/${currentItem.eventId}/review/${detectionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Network response was not ok");

      toast.success(`Identity ${action === 'confirm' ? 'Confirmed' : action === 'reject' ? 'Rejected' : 'Skipped'}`, { id: toastId });

      // UI ADVANCE
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      toast.error("System sync failed. Please check connection.", { id: toastId });
      console.error(err);
    } finally {
      setIsProcessing(false);
      setShowFullImage(false);
    }
  };

  if (currentIndex >= queue.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-20 sm:py-32 bg-white border border-[#dbd8cf] rounded-[32px] shadow-sm max-w-2xl mx-auto"
      >
        <div className="w-16 h-16 bg-[#e6f5ee] rounded-[20px] flex items-center justify-center mx-auto mb-6 border border-[#2a7a4f]/20">
          <Check className="text-[#2a7a4f]" size={32} />
        </div>
        <h3 className="text-2xl font-serif font-bold text-[#0e0e0f]">Queue Cleared</h3>
        <p className="text-sm text-[#5a5a64] mt-2">All biometric samples have been processed.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 px-8 py-3.5 bg-[#0e0e0f] text-white rounded-xl text-[11px] font-mono font-bold uppercase tracking-[0.2em] hover:bg-[#c94a20] hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
        >
          <ShieldAlert size={14} /> Reload Engine
        </button>
      </motion.div>
    );
  }

  const face = currentItem.faceDetections[0];
  const box = face.boundingBox;
  const progress = ((currentIndex) / queue.length) * 100;

  // Calculate dynamic exit animation values based on direction
  const exitX = exitDirection === "left" ? -300 : exitDirection === "right" ? 300 : 0;
  const exitY = exitDirection === "up" ? -300 : 0;
  const exitRotate = exitDirection === "left" ? -20 : exitDirection === "right" ? 20 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
      
      {/* SYSTEM STATUS HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end px-2 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-[#c94a20] uppercase tracking-[0.2em] font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c94a20] animate-pulse" />
            Biometric Review Terminal
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Pending Identities <span className="text-[#dbd8cf] font-sans ml-2">/</span> <span className="text-[#c8b89a] ml-1">{queue.length - currentIndex}</span>
          </h2>
        </div>
        
        <div className="text-left sm:text-right w-full sm:w-auto">
          <div className="flex justify-between sm:justify-end gap-4 text-[10px] font-mono text-[#5a5a64] mb-2 uppercase tracking-widest font-bold">
            <span>Engine Load</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full sm:w-32 h-1.5 bg-[#eceae4] rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-[#c94a20]" 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               transition={{ ease: "easeInOut" }}
             />
          </div>
        </div>
      </div>

      {/* INTELLIGENT VIEWPORT WITH SWIPE PHYSICS */}
      <div className="relative h-[450px] sm:h-[600px] perspective-[1000px]">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 0.9, z: -100 }}
            animate={{ opacity: 1, scale: 1, z: 0, x: 0, y: 0, rotate: 0 }}
            exit={{ opacity: 0, x: exitX, y: exitY, rotate: exitRotate, filter: "blur(10px)" }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            
            // TINDER-STYLE SWIPE PHYSICS
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x > 100 || velocity.x > 500) handleAction('confirm', 'right');
              else if (offset.x < -100 || velocity.x < -500) handleAction('reject', 'left');
            }}
            
            className="absolute inset-0 bg-white border border-[#dbd8cf] rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
          >
            {/* Image Area */}
            <div className="relative flex-1 bg-[#0d0d0f] overflow-hidden group pointer-events-none">
              <motion.img 
                key={showFullImage ? 'full' : 'crop'}
                src={currentItem.faceUrl || face.asset.signedUrl}
                className={cn(
                  "w-full h-full object-cover transition-all duration-700 ease-in-out",
                  showFullImage ? "scale-100 opacity-60" : "scale-[4]"
                )}
                style={!showFullImage ? {
                  objectPosition: `${(box.Left + box.Width / 2) * 100}% ${(box.Top + box.Height / 2) * 100}%`
                } : {}}
              />
              
              {/* Cinematic Scanline Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20 mix-blend-overlay" />

              {/* View Toggle Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); setShowFullImage(!showFullImage); }}
                className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10 pointer-events-auto active:scale-95"
              >
                <Maximize2 size={18} />
              </button>

              <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex gap-2">
                <span className="px-3 py-1.5 bg-[#c94a20]/90 backdrop-blur-sm text-white text-[10px] font-mono rounded-full border border-white/10 shadow-lg flex items-center gap-2 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Match Conf: {Math.round(face.confidence)}%
                </span>
              </div>
            </div>

            {/* ACTION CLUSTER */}
            <div className="p-4 sm:p-8 bg-white shrink-0">
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-mono text-[#c8b89a] uppercase tracking-widest mb-1">Source Asset</p>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-[#0e0e0f] truncate max-w-[200px] sm:max-w-full">{face.asset.sourceFilename}</h3>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <button 
                  onClick={() => handleAction('reject', "left")}
                  disabled={isProcessing}
                  className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-[20px] border border-[#dbd8cf] hover:border-red-200 hover:bg-red-50 hover:shadow-lg hover:shadow-red-500/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f5f4f0] group-hover:bg-red-500 group-hover:text-white flex items-center justify-center transition-all">
                    <X size={18} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">Reject</span>
                </button>

                <button 
                  onClick={() => handleAction('skip', "up")}
                  disabled={isProcessing}
                  className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-[20px] border border-[#dbd8cf] hover:bg-[#f5f4f0] transition-all active:scale-95 disabled:opacity-50"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f5f4f0] flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
                    <SkipForward size={18} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">Skip</span>
                </button>

                <button 
                  onClick={() => handleAction('confirm', "right")}
                  disabled={isProcessing}
                  className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-[20px] bg-[#0e0e0f] text-white hover:bg-[#c94a20] transition-all shadow-xl shadow-black/10 active:scale-95 disabled:opacity-50"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Check size={18} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">Confirm</span>
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* FOOTER SHORTCUTS GUIDANCE (Desktop Only) */}
      <div className="hidden sm:flex justify-center gap-8 text-[9px] font-mono text-[#c8b89a] uppercase tracking-widest">
         <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#c94a20]" /> [A] / ⇾ Approve</span>
         <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#5a5a64]" /> [R] / ⇽ Reject</span>
         <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#dbd8cf]" /> [V] Toggle View</span>
      </div>
      
      {/* Mobile Swipe Hint */}
      <div className="sm:hidden text-center text-[10px] font-mono text-[#c8b89a] uppercase tracking-widest animate-pulse">
        Swipe Left to Reject • Right to Approve
      </div>
    </div>
  );
}