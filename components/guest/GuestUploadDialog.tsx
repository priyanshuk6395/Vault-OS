"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUpload } from "@/context/UploadProvider";

export default function GuestUploadDialog({ 
  personId,
  eventId, 
  isOpen, 
  onClose 
}: { 
  eventId: string, 
  isOpen: boolean,
  personId: string,
  onClose: () => void 
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const { queue, addFilesToQueue, retryFailedTasks, clearCompletedTasks } = useUpload();
  const tasks = taskIds.map((taskId) => queue.find((task) => task.id === taskId));
  const uploading = tasks.some((task) => task?.status === "pending" || task?.status === "processing" || task?.status === "uploading");
  const complete = taskIds.length > 0 && tasks.length === taskIds.length && tasks.every((task) => task?.status === "complete");
  const failedCount = tasks.filter((task) => task?.status === "error").length;
  const progress = Object.fromEntries(taskIds.map((taskId, index) => [
    String(index), queue.find((task) => task.id === taskId)?.progress ?? 0,
  ]));

  useEffect(() => {
    if (complete) {
      const timeout = window.setTimeout(() => {
        setFiles([]);
        setTaskIds([]);
        clearCompletedTasks();
        onClose();
      }, 2500);
      return () => window.clearTimeout(timeout);
    }
  }, [complete, clearCompletedTasks, onClose]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    disabled: uploading || taskIds.length > 0
  });

  const removeFile = (index: number) => {
    if (uploading || taskIds.length > 0) return;
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSafeClose = () => {
    if (!uploading) onClose();
  };

  const handleUpload = async () => {
    if (failedCount > 0) {
      retryFailedTasks();
      return;
    }
    if (files.length === 0 || taskIds.length > 0) return;
    const queuedTaskIds = addFilesToQueue(files, eventId, personId);
    setTaskIds(queuedTaskIds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleSafeClose}>
      <DialogContent className="max-w-md bg-card border border-border text-card-foreground p-0 overflow-hidden rounded-xl shadow-2xl">
        <DialogTitle className="sr-only">Guest Upload</DialogTitle>
        
        <AnimatePresence mode="wait">
          {complete ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="py-24 flex flex-col items-center justify-center space-y-5"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1, damping: 15 }}
                className="w-20 h-20 bg-accent-teal/10 rounded-full flex items-center justify-center relative"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-accent-teal rounded-full blur-xl"
                />
                <CheckCircle2 size={40} className="text-accent-teal relative z-10" />
              </motion.div>
              <div className="text-center">
                <h3 className="font-serif text-2xl font-bold tracking-tight">Upload Secured</h3>
                <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-2">Awaiting admin clearance</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-7 space-y-6 flex flex-col max-h-[85vh]"
            >
              <header className="text-center relative">
                <button 
                  onClick={handleSafeClose} 
                  disabled={uploading}
                  className="absolute -right-2 -top-2 p-2 text-muted-foreground hover:text-foreground hover:bg-subtle rounded-full transition-colors disabled:opacity-0"
                >
                  <X size={18} />
                </button>
                <h2 className="text-xl font-serif font-bold tracking-tight">Contribute Photos</h2>
                <p className="text-[10px] text-accent-coral mt-1.5 uppercase tracking-[0.25em] font-mono font-bold">
                  {uploading ? "Pipeline Active" : "Vault Security: Active"}
                </p>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "shrink-0 border-2 border-dashed rounded-3xl p-8 transition-all duration-300 text-center cursor-pointer relative overflow-hidden",
                    isDragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-primary/30 hover:bg-subtle",
                    files.length > 0 && "py-6 border-border",
                    uploading && "pointer-events-none opacity-50"
                  )}
                >
                  <input {...getInputProps()} />
                  
                  {isDragActive && (
                    <motion.div 
                      layoutId="dropzone-glow"
                      className="absolute inset-0 bg-linear-to-b from-primary/20 to-transparent pointer-events-none" 
                    />
                  )}

                  <motion.div layout className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 relative z-10">
                    <Upload className={cn("transition-colors", isDragActive ? "text-primary" : "text-muted-foreground")} size={20} />
                  </motion.div>
                  <motion.p layout className="text-sm font-bold tracking-tight relative z-10">
                    {files.length > 0 ? "Add More Assets" : "Select memories to upload"}
                  </motion.p>
                  {files.length === 0 && (
                    <motion.p layout className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-2 relative z-10">
                      Max file size: 50MB
                    </motion.p>
                  )}
                </div>

                {files.length > 0 && (
                  <motion.div layout className="mt-6 flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    <AnimatePresence initial={false}>
                      {files.map((file, i) => (
                        <motion.div 
                          key={`${file.name}-${i}`}
                          layout
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                          className="group relative flex flex-col p-3.5 bg-background rounded-lg border border-border overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-2.5 relative z-10">
                            <div className="flex items-center gap-3 min-w-0">
                              <ImageIcon size={16} className="text-accent-coral shrink-0" />
                              <span className="text-[11px] font-medium truncate tracking-tight text-foreground">
                                {file.name}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {progress[String(i)] === 100 ? "100%" : `${progress[String(i)] || 0}%`}
                              </span>
                              {!uploading && taskIds.length === 0 ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                                  className="text-white/20 hover:text-red-400 hover:bg-red-400/10 p-1 rounded-md transition-all"
                                >
                                  <X size={14} />
                                </button>
                              ) : (
                                progress[String(i)] === 100 && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <CheckCircle2 size={16} className="text-accent-teal" />
                                  </motion.div>
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full h-1 bg-subtle rounded-full overflow-hidden relative z-10">
                            <motion.div 
                              className="h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress[String(i)] || 0}%` }}
                              transition={{ ease: "easeOut", duration: 0.2 }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>

              {files.length > 0 && (
                <div className="pt-4 mt-auto">
                  {failedCount > 0 && (
                    <p role="status" className="mb-3 text-sm text-accent-coral">
                      {failedCount} upload{failedCount === 1 ? "" : "s"} failed. Retry to continue.
                    </p>
                  )}
                  <motion.button 
                    whileHover={!uploading ? { scale: 1.02 } : {}}
                    whileTap={!uploading ? { scale: 0.98 } : {}}
                    onClick={handleUpload}
                    disabled={uploading || (taskIds.length > 0 && failedCount === 0)}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:brightness-110 transition-colors disabled:opacity-50 overflow-hidden relative"
                  >
                    {!uploading && (
                      <motion.div 
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent -skew-x-12"
                      />
                    )}
                    
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Transmitting {files.length} items...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        {failedCount > 0 ? "Retry Failed Uploads" : "Commit to Vault"}
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}