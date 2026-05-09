"use client";

import { useState } from "react";
import { Power, Loader2 } from "lucide-react";
import { logoutGuest } from "@/lib/actions/event-actions";
import { cn } from "@/lib/utils";

export default function LogoutButton({ eventId }: { eventId: string }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleLogout = async () => {
    setIsExiting(true);
    await logoutGuest(eventId);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isExiting}
      className={cn(
        "group flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300",
        "bg-white/5 border-white/10 text-white/40 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500",
        isExiting && "opacity-50 cursor-wait"
      )}
    >
      {isExiting ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Power size={14} className="group-hover:rotate-90 transition-transform duration-500" />
      )}
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
        {isExiting ? "Terminating..." : "Session Out"}
      </span>
    </button>
  );
}