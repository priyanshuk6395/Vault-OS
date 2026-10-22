"use client";

import { useUpload } from "@/context/UploadProvider";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, HardDriveUpload, RotateCcw, Trash2 } from "lucide-react";

export default function PipelineHUD() {
  const { queue, retryFailedTasks, clearCompletedTasks } = useUpload();
  const activeTasks = queue.filter(t => t.status !== "complete" && t.status !== "error");
  const failedCount = queue.filter((task) => task.status === "error").length;
  const completedCount = queue.filter((task) => task.status === "complete").length;

  if (activeTasks.length === 0 && failedCount === 0 && completedCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-72">
      <AnimatePresence>
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <HardDriveUpload className="text-primary w-5 h-5" />
            <span className="text-[10px] font-mono text-foreground tracking-widest uppercase">
              Pipeline: {activeTasks.length} active
            </span>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {activeTasks.map(task => (
              <div key={task.id} className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                  <span className="truncate w-32">{task.fileName}</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="h-1 bg-subtle rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} className="h-full bg-primary" />
                </div>
                <p className="text-[9px] text-muted-foreground">{task.statusMessage}</p>
              </div>
            ))}
          </div>
          {(failedCount > 0 || completedCount > 0) && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              {failedCount > 0 ? (
                <button type="button" onClick={retryFailedTasks} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-coral hover:underline">
                  <RotateCcw size={13} aria-hidden="true" />
                  Retry {failedCount} failed
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-accent-teal">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {completedCount} secured
                </span>
              )}
              {completedCount > 0 && (
                <button type="button" onClick={clearCompletedTasks} aria-label="Clear completed uploads" title="Clear completed uploads" className="p-1.5 text-muted-foreground hover:text-foreground">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}