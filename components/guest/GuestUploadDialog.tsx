"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";

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
    accept: { 'image/*': [], 'video/*': [] }
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    
    try {
      for (const file of files) {
        // 1. HANDSHAKE (Standardized keys: uploadUrl & assetId)
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

        // 2. DIRECT S3 UPLOAD WITH PROGRESS (XHR)
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

        // 3. COMPLETE
        await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
      }

      setComplete(true);
      setTimeout(() => {
        setComplete(false);
        setFiles([]);
        setProgress({});
        onClose();
      }, 2500);

    } catch (err) {
      console.error(err);
      alert("One or more files failed to upload. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0d0d0f] border-white/10 text-white p-0 overflow-hidden rounded-3xl shadow-2xl">
        <DialogTitle className="sr-only">Guest Upload</DialogTitle>
        
        {complete ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-500">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-serif text-xl font-bold">Upload Successful</p>
              <p className="text-white/40 text-sm mt-1">Awaiting admin moderation.</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <header className="text-center">
              <h2 className="text-xl font-serif font-bold">Contribute Photos</h2>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.2em] font-mono">
                Vault Security: Active
              </p>
            </header>

            {!uploading && files.length === 0 ? (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-12 transition-all text-center cursor-pointer
                  ${isDragActive ? 'border-[#c94a20] bg-[#c94a20]/5' : 'border-white/5 hover:border-white/20 hover:bg-white/[0.02]'}`}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="text-white/40" size={20} />
                </div>
                <p className="text-sm font-medium">Select memories to upload</p>
                <p className="text-[10px] text-white/20 mt-2">Maximum file size: 50MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {files.map((file, i) => (
                    <div key={i} className="group flex flex-col p-3 bg-white/5 rounded-xl border border-white/5 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <ImageIcon size={14} className="text-white/20" />
                          <span className="text-xs truncate max-w-[200px]">{file.name}</span>
                        </div>
                        {!uploading && (
                          <button onClick={() => removeFile(i)} className="text-white/20 hover:text-red-400 transition-colors">
                            <X size={14} />
                          </button>
                        )}
                        {progress[file.name] === 100 && <CheckCircle2 size={14} className="text-green-500" />}
                      </div>
                      
                      {/* Progress Bar */}
                      {uploading && (
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#c94a20] transition-all duration-300"
                            style={{ width: `${progress[file.name] || 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                  className="w-full py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#c94a20] hover:text-white transition-all disabled:opacity-20 active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading {files.length} items...
                    </>
                  ) : (
                    <>Submit to {eventId.slice(0, 8)} Vault</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}