"use client";

import { useState } from "react";
import { X, Sparkles, ShieldCheck } from "lucide-react";
import { Portal } from "@/components/ui/Portal";

export default function CreateEventModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/events/create", {
      method: "POST",
      body: JSON.stringify({ name, passcode }),
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      window.location.reload(); // Refresh to show new event in switcher
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-card-foreground flex items-center gap-2">
            <Sparkles className="text-primary" size={20} /> New Event Vault
          </h2>
          <button onClick={onClose} aria-label="Close create event dialog" className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Event Name</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Goa Wedding 2026" 
              className="w-full bg-background border border-input rounded-md px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Guest Passcode</label>
            <input 
              value={passcode} 
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              placeholder="e.g. 482915" 
              className="w-full bg-background border border-input rounded-md px-4 py-3 text-foreground font-mono tracking-widest focus:border-primary outline-none transition-all" 
            />
          </div>

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-md flex gap-3">
            <ShieldCheck className="text-primary shrink-0" size={18} />
            <p className="text-[11px] text-foreground leading-relaxed">
              Creating this event will initialize a private biometric collection. All data will be isolated and encrypted.
            </p>
          </div>

          <button 
            onClick={handleCreate}
            disabled={loading || !name.trim() || passcode.length !== 6}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-md mt-4 hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? "Initializing Vault..." : "Create Event Vault"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}