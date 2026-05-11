"use client";

import { useUpload } from "@/context/UploadProvider";
import { motion, AnimatePresence } from "framer-motion";
import { HardDriveUpload } from "lucide-react";

export default function PipelineHUD() {
  const { queue } = useUpload();
  const activeTasks = queue.filter(t => t.status !== "complete" && t.status !== "error");

  if (activeTasks.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-72">
      <AnimatePresence>
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          className="bg-[#0e0e0f] border border-[#c94a20]/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <HardDriveUpload className="text-[#c94a20] w-5 h-5 animate-pulse" />
            <span className="text-[10px] font-mono text-white tracking-widest uppercase">
              Pipeline: {activeTasks.length} Active
            </span>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {activeTasks.map(task => (
              <div key={task.id} className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-white/50">
                  <span className="truncate w-32">{task.fileName}</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} className="h-full bg-[#c94a20]" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}