"use client";

import React, { createContext, useContext, useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { v4 as uuidv4 } from "uuid";

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "processing" | "uploading" | "complete" | "error";
  statusMessage: string; // <-- NEW: Granular feedback for the HUD
  eventId: string;
  uploaderId?: string;
  assetId?: string;
  file?: File;
}

type UploadFailureStage = "preparing" | "initializing" | "s3-put" | "finalizing";

interface UploadContextType {
  queue: UploadTask[];
  addFilesToQueue: (files: File[], eventId: string, uploaderId?: string) => string[];
  retryFailedTasks: () => void;
  clearCompletedTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 600): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelay * 2 ** attempt));
    }
  }
}

export const UploadProvider = ({ children }: { children: React.ReactNode }) => {
  const [uiQueue, setUiQueue] = useState<UploadTask[]>([]);
  const queueRef = useRef<UploadTask[]>([]);
  const activeUploads = useRef(0);
  const hardwareConcurrency = typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency || 4;
  const maxConcurrency = Math.max(3, Math.min(hardwareConcurrency, 6));

  const syncUI = () => setUiQueue([...queueRef.current]);

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    queueRef.current = queueRef.current.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    );
    syncUI();
  };

  const executeUploadPipeline = async (
    task: UploadTask,
    onAssetInitialized: (assetId: string) => void,
    onStageChange: (stage: UploadFailureStage) => void,
  ) => {
    const originalFile = task.file;
    if (!originalFile) throw new Error("Upload task has no file");

    let fileToUpload = originalFile;
    const isImage = originalFile.type.startsWith("image/") || /\.(heic|heif)$/i.test(originalFile.name);

    if (isImage) {
      if (/\.(heic|heif)$/i.test(originalFile.name)) {
        updateTask(task.id, { statusMessage: "Decoding HEIC image..." });
        const heic2any = (await import("heic2any")).default;
        const decoded = await heic2any({ blob: originalFile, toType: "image/jpeg", quality: 0.85 });
        const jpegBlob = Array.isArray(decoded) ? decoded[0] : decoded;
        const jpegName = originalFile.name.replace(/\.(heic|heif)$/i, ".jpg");
        fileToUpload = new File([jpegBlob], jpegName, { type: "image/jpeg", lastModified: originalFile.lastModified });
      }

      updateTask(task.id, { statusMessage: "Converting to WebP..." });
      const compressed = await imageCompression(fileToUpload, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.85,
      });
      const webpName = fileToUpload.name.replace(/\.[^.]+$/, ".webp");
      fileToUpload = new File([compressed], webpName, {
        type: "image/webp",
        lastModified: originalFile.lastModified,
      });
    }

    onStageChange("initializing");
    updateTask(task.id, { statusMessage: "Requesting upload URL...", status: "uploading" });
    const initialized = await withRetry(async () => {
      const response = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: task.eventId,
          filename: fileToUpload.name,
          contentType: fileToUpload.type || "application/octet-stream",
          size: fileToUpload.size,
          assetType: fileToUpload.type.startsWith("video/") ? "video" : "image",
          uploaderId: task.uploaderId,
          clientUploadId: task.id,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: unknown } | null;
        const detail = typeof data?.error === "string" ? `: ${data.error}` : "";
        throw new Error(`Upload initialization failed (${response.status})${detail}`);
      }
      const data = await response.json();
      if (!data.uploadUrl || !data.assetId) throw new Error("Upload initialization response was incomplete");
      onAssetInitialized(data.assetId);
      updateTask(task.id, { assetId: data.assetId });
      return data as { uploadUrl: string; assetId: string };
    });

    onStageChange("s3-put");
    updateTask(task.id, { statusMessage: "Uploading..." });
    await withRetry(() => new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", initialized.uploadUrl);
      xhr.setRequestHeader("Content-Type", fileToUpload.type || "application/octet-stream");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          if (progress % 5 === 0 || progress === 100) updateTask(task.id, { progress });
        }
      };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error("Storage upload network error"));
      xhr.send(fileToUpload);
    }));

    onStageChange("finalizing");
    for (let attempt = 0; attempt < 300; attempt += 1) {
      updateTask(task.id, {
        statusMessage: attempt === 0 ? "Starting AI indexing..." : "AI indexing in progress...",
      });
      const stillProcessing = await withRetry(async () => {
        const response = await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: initialized.assetId, uploaderId: task.uploaderId }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: unknown } | null;
          const detail = typeof data?.error === "string" ? `: ${data.error}` : "";
          throw new Error(`Upload finalization failed (${response.status})${detail}`);
        }
        return response.status === 202;
      });
      if (!stillProcessing) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Timed out while waiting for image processing to finish");
  };

  const processTask = async (task: UploadTask) => {
    updateTask(task.id, { status: "processing", statusMessage: "Preparing image..." });
    let assetId: string | undefined;
    let failureStage: UploadFailureStage = "preparing";
    try {
      await executeUploadPipeline(
        task,
        (initializedAssetId) => { assetId = initializedAssetId; },
        (stage) => { failureStage = stage; },
      );
      updateTask(task.id, { status: "complete", progress: 100, statusMessage: "Secured" });
    } catch (error) {
      console.error(`[UPLOAD_FAILED] ${task.fileName}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error";
      if (assetId) {
        try {
          const response = await fetch("/api/upload/fail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId, uploaderId: task.uploaderId, failureStage, errorMessage }),
          });
          if (!response.ok) console.error(`[UPLOAD_FAILURE_REPORT_FAILED] ${task.fileName}: ${response.status}`);
        } catch (reportError) {
          console.error(`[UPLOAD_FAILURE_REPORT_FAILED] ${task.fileName}:`, reportError);
        }
      }
      updateTask(task.id, { status: "error", statusMessage: "Upload failed. Retry available." });
    }
  };

  const processQueue = () => {
    while (activeUploads.current < maxConcurrency) {
      const task = queueRef.current.find((candidate) => candidate.status === "pending");
      if (!task) return;
      activeUploads.current += 1;
      void processTask(task).finally(() => {
        activeUploads.current -= 1;
        processQueue();
      });
    }
  };

  const addFilesToQueue = (files: File[], eventId: string, uploaderId?: string) => {
    const newTasks: UploadTask[] = files.map((f) => ({
      id: uuidv4(),
      fileName: f.name,
      progress: 0,
      status: "pending",
      statusMessage: "Queued...",
      eventId,
      uploaderId,
      file: f,
    }));

    queueRef.current = [...queueRef.current, ...newTasks];
    syncUI();
    processQueue();
    return newTasks.map((task) => task.id);
  };

  const retryFailedTasks = () => {
    queueRef.current = queueRef.current.map((task) => task.status === "error"
      ? { ...task, status: "pending", progress: 0, statusMessage: "Queued for retry..." }
      : task);
    syncUI();
    processQueue();
  };

  const clearCompletedTasks = () => {
    queueRef.current = queueRef.current.filter((task) => task.status !== "complete");
    syncUI();
  };

  return (
    <UploadContext.Provider value={{ queue: uiQueue, addFilesToQueue, retryFailedTasks, clearCompletedTasks }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used within an UploadProvider");
  return context;
};