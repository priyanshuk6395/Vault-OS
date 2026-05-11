"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "processing" | "uploading" | "complete" | "error";
  eventId: string;
  file?: File;
}

interface UploadContextType {
  queue: UploadTask[];
  addFilesToQueue: (files: File[], eventId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider = ({ children }: { children: React.ReactNode }) => {
  const [queue, setQueue] = useState<UploadTask[]>([]);

  // Ref tracks which IDs are actively being processed to prevent React double-fires
  const processingIds = useRef<Set<string>>(new Set());
  const MAX_CONCURRENCY = 2; // Magic number to prevent mobile RAM crashes

  const updateTask = (id: string, updates: Partial<UploadTask>) => {
    setQueue((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    );
  };

  const addFilesToQueue = (files: File[], eventId: string) => {
    const newTasks: UploadTask[] = files.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      fileName: f.name,
      progress: 0,
      status: "pending",
      eventId,
      file: f,
    }));

    setQueue((prev) => [...prev, ...newTasks]);
  };

  const executeUploadPipeline = async (
    file: File,
    taskId: string,
    eventId: string,
  ) => {
    let fileToProcess = file;

    // 1. HEIC Conversion
    if (file.name.match(/\.(heic|heif)$/i)) {
      try {
        const heic2any = (await import("heic2any")).default;
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
      } catch (err) {
        console.warn(`[HEIC Skip] ${file.name}: Fallback to original.`);
      }
    }

    // 2. RAM-Intensive Compression
    try {
      const imageCompression = (await import("browser-image-compression"))
        .default;
      fileToProcess = await imageCompression(fileToProcess, {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      });
    } catch (err) {
      console.warn(`[Compression Skip] ${file.name}`);
    }

    updateTask(taskId, { status: "uploading" });

    // 3. Init Handshake (DB Creation)
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

    if (!initRes.ok) throw new Error("Init Failed");
    const { uploadUrl, assetId } = await initRes.json();

    // 4. S3 Upload Stream
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", fileToProcess.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateTask(taskId, { progress: percent });
        }
      };

      xhr.onload = () =>
        xhr.status === 200 ? resolve(true) : reject("S3 PUT Failed");
      xhr.onerror = () => reject("Network Error");
      xhr.send(fileToProcess);
    });

    // 5. Completion Signal
    await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
  };

  // ⚙️ THE ENGINE LOOP: Automatically triggers when the queue changes
  useEffect(() => {
    const startNextTasks = () => {
      // Find tasks that are pending AND not already locked in the processing set
      const pendingTasks = queue.filter(
        (t) => t.status === "pending" && !processingIds.current.has(t.id),
      );

      // Fill available slots up to MAX_CONCURRENCY
      for (const task of pendingTasks) {
        if (processingIds.current.size >= MAX_CONCURRENCY) break;

        // 1. Lock the task slot
        processingIds.current.add(task.id);

        // 2. Update UI State
        updateTask(task.id, { status: "processing" });

        // 3. Execute the pipeline
        executeUploadPipeline(task.file!, task.id, task.eventId)
          .then(() => {
            // Unlock and mark complete
            processingIds.current.delete(task.id);
            updateTask(task.id, { status: "complete", progress: 100 });
          })
          .catch((err) => {
            console.error(`[PIPELINE_FAILED] ${task.fileName}:`, err);
            // Unlock and mark as error
            processingIds.current.delete(task.id);
            updateTask(task.id, { status: "error" });
          });
      }
    };

    startNextTasks();
  }, [queue]); // Re-evaluate whenever the queue changes

  return (
    <UploadContext.Provider value={{ queue, addFilesToQueue }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context)
    throw new Error("useUpload must be used within an UploadProvider");
  return context;
};
