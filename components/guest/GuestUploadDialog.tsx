"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [complete, setComplete] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    disabled: uploading
  });

  const removeFile = (index: number) => {
    if (uploading) return;
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSafeClose = () => {
    if (!uploading) onClose();
  };

  const handleUpload = async () => {
    setUploading(true);
    
    // 🧠 ADAPTIVE CONCURRENCY ENGINE
    const deviceCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2;
    const MAX_CONCURRENT_UPLOADS = Math.max(2, Math.min(deviceCores || 2, 6));
    
    let currentIndex = 0;
    const failedUploads: string[] = [];

    const uploadSingleFile = async (file: File) => {
      try {
        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            filename: file.name,
            contentType: file.type,
            size: file.size,
            assetType: file.type.startsWith("video") ? "video" : "image",
            uploaderId: personId,
          }),
        });

        if (!initRes.ok) throw new Error("Initialization failed");
        const { uploadUrl, assetId } = await initRes.json();

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(prev => ({ ...prev, [file.name]: percent }));
          }
        };

        await new Promise((resolve, reject) => {
          xhr.onload = () => xhr.status === 200 ? resolve(xhr.response) : reject();
          xhr.onerror = () => reject();
          xhr.send(file);
        });

        await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        failedUploads.push(file.name);
      }
    };

    const worker = async () => {
      while (currentIndex < files.length) {
        const indexToProcess = currentIndex++; 
        await uploadSingleFile(files[indexToProcess]);
      }
    };

    try {
      const workers = Array.from({ length: MAX_CONCURRENT_UPLOADS }, () => worker());
      await Promise.all(workers);

      if (failedUploads.length > 0) {
        alert(`Finished, but ${failedUploads.length} files failed to upload. Please try them again.`);
      }

      setComplete(true);
      setTimeout(() => {
        setComplete(false);
        setFiles([]);
        setProgress({});
        onClose();
      }, 2500);

    } catch (err) {
      console.error("Critical pool failure:", err);
      alert("A critical error interrupted the upload pipeline.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleSafeClose}>
      <DialogContent className="max-w-md bg-[#0d0d0f] border border-white/10 text-white p-0 overflow-hidden rounded-[2rem] shadow-2xl">
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
                className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center relative"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-green-500 rounded-full blur-xl"
                />
                <CheckCircle2 size={40} className="text-green-500 relative z-10" />
              </motion.div>
              <div className="text-center">
                <h3 className="font-serif text-2xl font-bold tracking-tight">Upload Secured</h3>
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest mt-2">Awaiting admin clearance</p>
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
                  className="absolute -right-2 -top-2 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-0"
                >
                  <X size={18} />
                </button>
                <h2 className="text-xl font-serif font-bold tracking-tight">Contribute Photos</h2>
                <p className="text-[10px] text-[#c94a20] mt-1.5 uppercase tracking-[0.25em] font-mono font-bold">
                  {uploading ? "Pipeline Active" : "Vault Security: Active"}
                </p>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "shrink-0 border-2 border-dashed rounded-3xl p-8 transition-all duration-300 text-center cursor-pointer relative overflow-hidden",
                    isDragActive ? "border-[#c94a20] bg-[#c94a20]/10 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
                    files.length > 0 && "py-6 border-white/5",
                    uploading && "pointer-events-none opacity-50"
                  )}
                >
                  <input {...getInputProps()} />
                  
                  {isDragActive && (
                    <motion.div 
                      layoutId="dropzone-glow"
                      className="absolute inset-0 bg-gradient-to-b from-[#c94a20]/20 to-transparent pointer-events-none" 
                    />
                  )}

                  <motion.div layout className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 relative z-10">
                    <Upload className={cn("transition-colors", isDragActive ? "text-[#c94a20]" : "text-white/40")} size={20} />
                  </motion.div>
                  <motion.p layout className="text-sm font-bold tracking-tight relative z-10">
                    {files.length > 0 ? "Add More Assets" : "Select memories to upload"}
                  </motion.p>
                  {files.length === 0 && (
                    <motion.p layout className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-2 relative z-10">
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
                          className="group relative flex flex-col p-3.5 bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-2.5 relative z-10">
                            <div className="flex items-center gap-3 min-w-0">
                              <ImageIcon size={16} className="text-[#c94a20] shrink-0" />
                              <span className="text-[11px] font-medium truncate tracking-tight text-white/90">
                                {file.name}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-mono text-white/40">
                                {progress[file.name] === 100 ? "100%" : `${progress[file.name] || 0}%`}
                              </span>
                              {!uploading ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                                  className="text-white/20 hover:text-red-400 hover:bg-red-400/10 p-1 rounded-md transition-all"
                                >
                                  <X size={14} />
                                </button>
                              ) : (
                                progress[file.name] === 100 && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <CheckCircle2 size={16} className="text-green-500" />
                                  </motion.div>
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative z-10">
                            <motion.div 
                              className="h-full bg-[#c94a20]"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress[file.name] || 0}%` }}
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
                  <motion.button 
                    whileHover={!uploading ? { scale: 1.02 } : {}}
                    whileTap={!uploading ? { scale: 0.98 } : {}}
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#c94a20] hover:text-white transition-colors disabled:opacity-50 overflow-hidden relative"
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
                        Commit to Vault
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