"use client";

import { useState } from "react";
import { X, Sparkles, ShieldCheck } from "lucide-react";

export default function CreateEventModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/events/create", {
      method: "POST",
      body: JSON.stringify({ name, passcode: passcode.toUpperCase() }),
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      window.location.reload(); // Refresh to show new event in switcher
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0e0e0f] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
            <Sparkles className="text-[#c94a20]" size={20} /> New Event Vault
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase text-white/30 tracking-widest">Event Name</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Goa Wedding 2026" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#c94a20] outline-none transition-all" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase text-white/30 tracking-widest">Guest Passcode</label>
            <input 
              value={passcode} 
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="e.g. GOA-VIBES" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono tracking-widest focus:border-[#c94a20] outline-none transition-all" 
            />
          </div>

          <div className="p-4 bg-[#c94a20]/10 border border-[#c94a20]/20 rounded-xl flex gap-3">
            <ShieldCheck className="text-[#c94a20] shrink-0" size={18} />
            <p className="text-[11px] text-[#c94a20]/80 leading-relaxed">
              Creating this event will initialize a private biometric collection. All data will be isolated and encrypted.
            </p>
          </div>

          <button 
            onClick={handleCreate}
            disabled={loading || !name || !passcode}
            className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {loading ? "Initializing Vault..." : "Create Event Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}