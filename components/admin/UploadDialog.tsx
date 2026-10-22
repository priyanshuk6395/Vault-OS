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
            className="relative bg-card text-card-foreground w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border"
          >
            <div className="p-7 pb-6 border-b border-border flex justify-between items-center bg-subtle">
              <div>
                <h3 className="text-xl font-extrabold text-foreground tracking-tighter">
                  System Ingestion
                </h3>
                <p className="text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-accent-coral mt-1.5">
                  Staging Environment
                </p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleAbort} 
                className="p-2.5 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={20} className="text-foreground" />
              </motion.button>
            </div>

            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
              <label className={cn(
                  "group relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-[1.75rem] cursor-pointer overflow-hidden transition-colors duration-500",
                  files.length > 0
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary"
              )}>
                {/* Subtle pulse effect behind the icon when active */}
                {files.length > 0 && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0, 0.1] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute w-24 h-24 bg-primary rounded-full blur-2xl"
                  />
                )}
                <Upload className="w-9 h-9 text-primary mb-3.5 group-hover:-translate-y-1 transition-transform duration-300 relative z-10" />
                <span className="text-sm font-bold uppercase tracking-tight text-foreground relative z-10">
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
                        className="bg-background-elevated border border-border p-4.5 rounded-lg flex items-center gap-4.5 shadow-sm"
                      >
                        <ImageIcon size={19} className="text-accent-coral shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold truncate tracking-tight text-foreground block">
                            {file.name}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            Ready for background processing
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            <div className="p-8 bg-subtle border-t border-border flex gap-5 items-center z-10">
              <button 
                onClick={handleAbort} 
                className="w-[100px] text-left py-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Abort
              </button>
              <motion.button
                whileHover={files.length > 0 ? { scale: 1.01 } : {}}
                whileTap={files.length > 0 ? { scale: 0.97 } : {}}
                onClick={handleCommit}
                disabled={files.length === 0}
                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-[0.25em] disabled:opacity-40 flex items-center justify-center gap-3.5 overflow-hidden relative shadow-lg shadow-primary/20"
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