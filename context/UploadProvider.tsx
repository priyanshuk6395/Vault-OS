"use client";

import React, { createContext, useContext, useState, useRef } from "react";

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "processing" | "uploading" | "complete" | "error";
  statusMessage: string; // <-- NEW: Granular feedback for the HUD
  eventId: string;
  file?: File;
}

interface UploadContextType {
  queue: UploadTask[];
  addFilesToQueue: (files: File[], eventId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider = ({ children }: { children: React.ReactNode }) => {
  // UI State (Only used for rendering the visual HUD)
  const [uiQueue, setUiQueue] = useState<UploadTask[]>([]);
  
  // THE ENGINE MEMORY: Completely immune to React lifecycle batching
  const queueRef = useRef<UploadTask[]>([]);
  const activeUploads = useRef(0);
  const MAX_CONCURRENCY = 2; // Safe limit for RAM

  // Syncs the background memory to the visible UI
  const syncUI = () => setUiQueue([...queueRef.current]);

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    queueRef.current = queueRef.current.map((task) => 
      task.id === id ? { ...task, ...updates } : task
    );
    syncUI();
  };

  const addFilesToQueue = (files: File[], eventId: string) => {
    const newTasks: UploadTask[] = files.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      fileName: f.name,
      progress: 0,
      status: "pending",
      statusMessage: "Queued...",
      eventId,
      file: f,
    }));

    queueRef.current = [...queueRef.current, ...newTasks];
    syncUI();
    
    // Ignite the engine instantly
    processQueue();
  };

  // ⚙️ THE WORKER ENGINE
  const processQueue = async () => {
    if (activeUploads.current >= MAX_CONCURRENCY) return;

    // Grab the very first pending task directly from memory
    const task = queueRef.current.find((t) => t.status === "pending");
    if (!task || !task.file) return;

    activeUploads.current += 1;
    updateTask(task.id, { status: "processing", statusMessage: "Initializing..." });

    try {
      await executeUploadPipeline(task.file, task.id, task.eventId);
      updateTask(task.id, { status: "complete", progress: 100, statusMessage: "Secured" });
    } catch (error) {
      console.error(`[PIPELINE_FAILED] ${task.fileName}:`, error);
      updateTask(task.id, { status: "error", statusMessage: "Failed" });
    } finally {
      activeUploads.current -= 1;
      // Recursively call processQueue to instantly pull the next file
      processQueue(); 
    }
  };

  // 🚀 THE PIPELINE
  const executeUploadPipeline = async (file: File, taskId: string, eventId: string) => {
    let fileToProcess = file;

    // 1. HEIC Conversion (Dynamic Import prevents server crash)
    if (file.name.match(/\.(heic|heif)$/i)) {
      updateTask(taskId, { statusMessage: "Converting Format..." });
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        const blobData = Array.isArray(blob) ? blob[0] : blob;
        fileToProcess = new File([blobData], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      } catch (err) {
        console.warn(`[HEIC Skip] ${file.name}`);
      }
    }

    // 2. RAM-Intensive Compression
    updateTask(taskId, { statusMessage: "Compressing Payload..." });
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      fileToProcess = await imageCompression(fileToProcess, {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });
    } catch (err) {
      console.warn(`[Compression Skip] ${file.name}`);
    }

    // 3. AWS Handshake
    updateTask(taskId, { statusMessage: "Generating Keys...", status: "uploading" });
    const initRes = await fetch("/api/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        filename: fileToProcess.name,
        contentType: fileToProcess.type,
        size: fileToProcess.size,
        assetType: "image",
      }),
    });

    if (!initRes.ok) throw new Error("Infrastructure Handshake Failed");
    const { uploadUrl, assetId } = await initRes.json();

    // 4. S3 Transmission
    updateTask(taskId, { statusMessage: "Transmitting..." });
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", fileToProcess.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          // Throttling UI updates to prevent React from freezing on fast connections
          if (percent % 5 === 0 || percent === 100) {
            updateTask(taskId, { progress: percent });
          }
        }
      };

      xhr.onload = () => (xhr.status === 200 ? resolve(true) : reject("S3 PUT Failed"));
      xhr.onerror = () => reject("Network Error");
      xhr.send(fileToProcess);
    });

    // 5. Completion Protocol
    updateTask(taskId, { statusMessage: "Verifying Hash..." });
    await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
  };

  return (
    <UploadContext.Provider value={{ queue: uiQueue, addFilesToQueue }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used within an UploadProvider");
  return context;
};