"use client";

import { useState } from "react";
import { X, Upload, ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import heic2any from "heic2any";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface UploadDialogProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function UploadDialog({
  eventId,
  isOpen,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  async function compressImageResilient(file: File) {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      initialQuality: 0.8,
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.warn(`[Compression Skip] ${file.name}: Proceeding with original.`);
      return file;
    }
  }

  const uploadFiles = async () => {
    if (!eventId || eventId === "undefined") {
      console.error("[PIPELINE_ABORT] Missing eventId. Check parent component props.");
      setStatusMessage("Error: System failed to resolve Vault ID.");
      return;
    }

    setUploading(true);
    setStatusMessage("Initializing vault ingestion...");

    const uploadTasks = files.map(async (file) => {
      try {
        let fileToProcess = file;

        if (file.name.match(/\.(heic|heif)$/i)) {
          setStatusMessage(`Converting ${file.name}...`);
          try {
            const blob = await heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 0.8,
            });
            const blobData = Array.isArray(blob) ? blob[0] : blob;
            fileToProcess = new File(
              [blobData],
              file.name.replace(/\.(heic|heif)$/i, ".jpg"),
              { type: "image/jpeg" }
            );
          } catch (err) {
            console.warn(`[HEIC Skip] ${file.name}: Fallback to original.`);
          }
        }

        setStatusMessage(`Optimizing ${fileToProcess.name}...`);
        const finalFile = await compressImageResilient(fileToProcess);

        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            filename: finalFile.name,
            contentType: finalFile.type,
            size: finalFile.size,
            assetType: "image",
          }),
        });

        if (!initRes.ok) {
           const errText = await initRes.text();
           throw new Error(`Init Failed (${initRes.status}): ${errText}`);
        }

        const { uploadUrl, assetId } = await initRes.json();

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", finalFile.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setProgress((prev) => ({ ...prev, [file.name]: percent }));
            }
          };

          xhr.onload = () => (xhr.status === 200 ? resolve(true) : reject());
          xhr.onerror = () => reject();
          xhr.send(finalFile);
        });

        await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });

      } catch (err) {
        console.error(`[CRITICAL_PIPELINE_ERROR] ${file.name}:`, err);
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
      }
    });

    await Promise.all(uploadTasks);
    setUploading(false);
    setFiles([]);
    onUploadComplete();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 1. Backdrop Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!uploading ? onClose : undefined}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* 2. Modal Entrance/Exit */}
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
                <AnimatePresence mode="wait">
                  <motion.p
                    key={statusMessage || "awaiting"}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-[#c94a20] mt-1.5"
                  >
                    {uploading ? statusMessage : "Awaiting Assets"}
                  </motion.p>
                </AnimatePresence>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose} 
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
                <input type="file" multiple accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>

              {files.length > 0 && (
                <motion.div layout className="mt-9 space-y-3.5">
                  <AnimatePresence>
                    {files.map((file, idx) => (
                      <motion.div 
                        key={file.name}
                        layout // Enables smooth re-ordering
                        initial={{ opacity: 0, x: -10, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.04 }} // 3. Staggered Entrance
                        className="bg-white border border-[#dbd8cf] p-4.5 rounded-2xl flex items-center gap-4.5 shadow-sm"
                      >
                        <ImageIcon size={19} className="text-[#c94a20] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] font-bold truncate tracking-tight text-[#0e0e0f]">
                              {file.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#c94a20]">
                              {progress[file.name] === 100 ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <CheckCircle2 size={15} className="text-green-600" />
                                </motion.div>
                              ) : (
                                `${progress[file.name] || 0}%`
                              )}
                            </span>
                          </div>
                          <div className="w-full bg-[#dbd8cf]/40 h-1 rounded-full overflow-hidden">
                            <motion.div 
                              className="bg-[#c94a20] h-full" 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress[file.name] || 0}%` }}
                              transition={{ ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            <div className="p-8 bg-[#f5f4f0] border-t border-[#dbd8cf] flex gap-5 items-center z-10">
              <button 
                onClick={onClose} 
                disabled={uploading} 
                className="w-[100px] text-left py-4 text-xs font-bold uppercase tracking-[0.3em] text-[#5a5a64] hover:text-[#0e0e0f] transition-colors disabled:opacity-30"
              >
                Abort
              </button>
              <motion.button
                whileHover={files.length > 0 && !uploading ? { scale: 1.01 } : {}}
                whileTap={files.length > 0 && !uploading ? { scale: 0.97 } : {}}
                onClick={uploadFiles}
                disabled={files.length === 0 || uploading}
                className="flex-1 py-4 bg-[#e8dbd1] text-[#0e0e0f] rounded-2xl text-xs font-bold uppercase tracking-[0.25em] disabled:opacity-40 flex items-center justify-center gap-3.5 overflow-hidden relative"
              >
                {/* Button shine effect */}
                {!uploading && files.length > 0 && (
                  <motion.div 
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
                  />
                )}
                
                {uploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={17} className="text-[#0e0e0f]/60" />
                )}
                {uploading ? `Processing ${files.length}` : `Commit ${files.length} Assets`}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}