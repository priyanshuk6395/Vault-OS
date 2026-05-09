"use client";

import { useState } from "react";
import {
  X,
  Upload,
  ImageIcon,
  Loader2,
  CheckCircle2,
  FileWarning,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import heic2any from "heic2any"; // Handles HEIC/HEIF conversion
import { cn } from "@/lib/utils";

export default function UploadDialog({
  eventId,
  isOpen,
  onClose,
  onUploadComplete,
}: any) {
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
    } catch (error: any) {
      // If it's already readable (Code 1) or any compression error occurs,
      // we return the original file. This is the "Fail-Safe" approach.
      console.warn(
        `[Compression Skip] ${file.name}: Proceeding with original.`,
      );
      return file;
    }
  }

  const uploadFiles = async () => {
    setUploading(true);
    setStatusMessage("Starting universal processing...");

    const uploadTasks = files.map(async (file) => {
      try {
        let fileToProcess = file;

        // Step 1: HEIC Conversion
        if (
          file.name.match(/\.(heic|heif)$/i) &&
          file.type !== "image/jpeg" &&
          file.type !== "image/png"
        ) {
          try {
            setStatusMessage(`Converting ${file.name}...`);

            const blob = await heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 0.8,
            });

            const blobData = Array.isArray(blob) ? blob[0] : blob;

            fileToProcess = new File(
              [blobData],
              file.name.replace(/\.(heic|heif)$/i, ".jpg"),
              { type: "image/jpeg" },
            );
          } catch (err: any) {
            // 🚨 IMPORTANT FIX
            if (err?.message?.includes("already browser readable")) {
              console.warn(`[HEIC Skip] ${file.name}: Already readable`);
              fileToProcess = file; // ✅ fallback
            } else {
              throw err; // real error → handled by outer catch
            }
          }
        }

        // Step 2: Resilient Compression (Using the helper)
        setStatusMessage(`Optimizing ${fileToProcess.name}...`);
        const finalFile = await compressImageResilient(fileToProcess);

        // Step 3: Initialize Asset
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

        const { uploadUrl, assetId } = await initRes.json();

        // Step 4: S3 Upload
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

        // Step 5: Notify Server
        fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId }),
        });
      } catch (err) {
        // This catch now ONLY handles real network/S3/DB failures
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#dbd8cf] flex justify-between items-center bg-[#fdf2e0]/20">
          <div>
            <h3 className="text-lg font-bold text-[#0e0e0f]">
              Universal Upload
            </h3>
            <p className="text-xs text-[#5a5a64] mt-0.5">
              Supporting HEIC, RAW, and High-Res formats.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f5f4f0] rounded-full transition-colors"
          >
            <X size={20} className="text-[#5a5a64]" />
          </button>
        </div>

        {/* Dropzone */}
        <div className="p-6 flex-1 overflow-y-auto">
          <label
            className={cn(
              "group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
              files.length > 0
                ? "border-[#c94a20] bg-[#fdf2e0]/30"
                : "border-[#dbd8cf] hover:border-[#c94a20] hover:bg-[#fdf2e0]/10",
            )}
          >
            <Upload className="w-6 h-6 text-[#c94a20] mb-2" />
            <span className="text-sm font-medium">Select Any Image Format</span>
            <input
              type="file"
              multiple
              accept="image/*,.heic,.heif,.raw,.HEIC,.HEIF,.RAW"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>

          {/* Progress List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              {uploading && (
                <div className="text-[10px] font-mono text-[#c94a20] animate-pulse mb-2 uppercase font-bold text-center">
                  {statusMessage}
                </div>
              )}
              {files.map((file) => (
                <div
                  key={file.name}
                  className="bg-[#f5f4f0] p-4 rounded-xl flex items-center gap-4"
                >
                  <ImageIcon size={18} className="text-[#c94a20]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] font-mono">
                        {progress[file.name] === 100 ? (
                          <CheckCircle2 size={14} className="text-green-600" />
                        ) : (
                          `${progress[file.name] || 0}%`
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-[#dbd8cf] h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-[#c94a20] h-full transition-all duration-300"
                        style={{ width: `${progress[file.name] || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#f5f4f0] border-t border-[#dbd8cf] flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-3 text-sm font-semibold text-[#5a5a64]"
          >
            Cancel
          </button>
          <button
            onClick={uploadFiles}
            disabled={files.length === 0 || uploading}
            className="flex-1 py-3 bg-[#0e0e0f] text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              `Upload ${files.length} Photos`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
