"use client";

import { useState } from "react";
import { X, Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload } from "@/context/UploadProvider";
import { motion, AnimatePresence } from "framer-motion";

interface UploadDialogProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void; // Optional now, since background handles it
}

export default function UploadDialog({
  eventId,
  isOpen,
  onClose,
}: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  
  // 1. Hook into the Global Background Queue
  const { addFilesToQueue } = useUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // 2. The Instant Handoff Protocol
  const handleCommit = () => {
    if (files.length === 0 || !eventId || eventId === "undefined") {
      console.error("[PIPELINE_ABORT] Missing files or Vault ID.");
      return;
    }

    // Push to the background throttle engine
    addFilesToQueue(files, eventId);
    
    // Instantly clear the local state and close the modal
    setFiles([]);
    onClose();
  };

  // If a user clicks cancel, we just clear the staged files and close
  const handleAbort = () => {
    setFiles([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleAbort}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Entrance/Exit */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-[#fdfcf9] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#dbd8cf]"
          >
            <div className="p-7 pb-6 border-b border-[#dbd8cf] flex justify-between items-center bg-[#fdf2e0]/30">
              <div>
                <h3 className="text-xl font-extrabold text-[#0e0e0f] tracking-tighter">
                  System Ingestion
                </h3>
                <p className="text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-[#c94a20] mt-1.5">
                  Staging Environment
                </p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleAbort} 
                className="p-2.5 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={20} className="text-[#0e0e0f]" />
              </motion.button>
            </div>

            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
              <label className={cn(
                  "group relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-[1.75rem] cursor-pointer overflow-hidden transition-colors duration-500",
                  files.length > 0
                    ? "border-[#c94a20] bg-[#fdf2e0]/30"
                    : "border-[#dbd8cf] hover:border-[#c94a20]"
              )}>
                {/* Subtle pulse effect behind the icon when active */}
                {files.length > 0 && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0, 0.1] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute w-24 h-24 bg-[#c94a20] rounded-full blur-2xl"
                  />
                )}
                <Upload className="w-9 h-9 text-[#c94a20] mb-3.5 group-hover:-translate-y-1 transition-transform duration-300 relative z-10" />
                <span className="text-sm font-bold uppercase tracking-tight text-[#0e0e0f] relative z-10">
                  {files.length > 0 ? `${files.length} FILES STAGED` : "Select Archive Files"}
                </span>
                <input type="file" multiple accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} />
              </label>

              {files.length > 0 && (
                <motion.div layout className="mt-9 space-y-3.5">
                  <AnimatePresence>
                    {files.map((file, idx) => (
                      <motion.div 
                        key={`${file.name}-${idx}`}
                        layout // Enables smooth re-ordering
                        initial={{ opacity: 0, x: -10, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.04 }} // Staggered Entrance
                        className="bg-white border border-[#dbd8cf] p-4.5 rounded-2xl flex items-center gap-4.5 shadow-sm"
                      >
                        <ImageIcon size={19} className="text-[#c94a20] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold truncate tracking-tight text-[#0e0e0f] block">
                            {file.name}
                          </span>
                          <span className="text-[9px] font-mono text-[#5a5a64]">
                            Ready for background processing
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            <div className="p-8 bg-[#f5f4f0] border-t border-[#dbd8cf] flex gap-5 items-center z-10">
              <button 
                onClick={handleAbort} 
                className="w-[100px] text-left py-4 text-xs font-bold uppercase tracking-[0.3em] text-[#5a5a64] hover:text-[#0e0e0f] transition-colors"
              >
                Abort
              </button>
              <motion.button
                whileHover={files.length > 0 ? { scale: 1.01 } : {}}
                whileTap={files.length > 0 ? { scale: 0.97 } : {}}
                onClick={handleCommit}
                disabled={files.length === 0}
                className="flex-1 py-4 bg-[#c94a20] text-white rounded-2xl text-xs font-bold uppercase tracking-[0.25em] disabled:opacity-40 flex items-center justify-center gap-3.5 overflow-hidden relative shadow-lg shadow-[#c94a20]/20"
              >
                {/* Button shine effect */}
                {files.length > 0 && (
                  <motion.div 
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                  />
                )}
                
                <Upload size={17} />
                Send to Background
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}