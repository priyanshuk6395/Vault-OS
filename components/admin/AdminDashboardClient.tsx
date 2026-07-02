"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { Plus, Activity, Settings, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Samples an image down to a single pixel to get its average color.
// Used to make each card's hover glow match its own theme image instead of a fixed accent.
function extractAverageColor(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        resolve(`${r},${g},${b}`);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// 1. EXTRACTED PICKER COMPONENT
function ThemePicker({ onSelect, current, eventId }: { onSelect: (key: string) => void, current: string, eventId: string }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/assets/approved`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setAssets(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const markLoaded = (key: string) =>
    setLoadedKeys((prev) => new Set(prev).add(key));

  return (
    <div
      className="grid grid-cols-3 gap-3 h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2"
      style={{ gridAutoRows: "min-content", alignItems: "start" }}
    >
      {loading ? (
        Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="w-full rounded-xl bg-white/5 border border-white/10 animate-pulse"
            style={{ aspectRatio: "1 / 1" }}
          />
        ))
      ) : assets.length === 0 ? (
        <div className="col-span-3 flex items-center justify-center h-full text-center text-[11px] font-mono text-white/20 uppercase tracking-widest">
          No approved assets yet
        </div>
      ) : (
        assets.map((a: any) => {
          const isSelected = current === a.storageKey;
          const isLoaded = loadedKeys.has(a.storageKey);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.storageKey)}
              className={cn(
                "relative block w-full rounded-xl overflow-hidden border-2 bg-[#1a1a1c] transition-all duration-300 hover:scale-[1.02] focus:outline-none shadow-inner",
                isSelected
                  ? "border-[#c94a20] shadow-[0_0_20px_rgba(201,74,32,0.35)]"
                  : "border-transparent hover:border-white/20"
              )}
              style={{ aspectRatio: "1 / 1" }}
            >
              {!isLoaded && (
                <div className="absolute inset-0 bg-white/5 animate-pulse" />
              )}
              <NextImage
                src={`/api/upload/view?key=${a.storageKey}`}
                onLoad={() => markLoaded(a.storageKey)}
                onError={() => markLoaded(a.storageKey)}
                fill
                sizes="150px"
                className={cn(
                  "object-cover object-center transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                alt="Asset thumbnail"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-[#c94a20]/30 flex items-center justify-center z-10">
                  <Check className="text-white drop-shadow-md" size={20} />
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

interface AdminDashboardClientProps {
  events: any[];
}

export default function AdminDashboardClient({ events: initialEvents }: AdminDashboardClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [themeImageUrl, setThemeImageUrl] = useState("");
  // Keyed by storageKey (not eventId) so a changed theme image always gets re-sampled,
  // while unrelated cards keep their cached color instead of re-fetching.
  const [glowColors, setGlowColors] = useState<Record<string, string>>({});

  useEffect(() => {
    events.forEach((event) => {
      if (event.themeImageUrl && !glowColors[event.themeImageUrl]) {
        extractAverageColor(`/api/upload/view?key=${event.themeImageUrl}`)
          .then((rgb) => setGlowColors((prev) => ({ ...prev, [event.themeImageUrl]: rgb })))
          .catch(() => {
            // Leave it unset — the CSS var fallback covers this case.
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const saveSettings = async () => {
    if (!editingEvent) return;
    const res = await fetch(`/api/events/${editingEvent.id}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, themeImageUrl }),
    });
    if (res.ok) {
      toast.success("Vault configuration updated.");
      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, title, themeImageUrl } : e)));
      setEditingEvent(null);
    }
  };

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[#dbd8cf] pb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[#0e0e0f]">Command Center</h1>
          <p className="text-[#5a5a64] mt-2 font-medium">Managing {events.length} biometric vaults.</p>
        </div>
        <Link href="/admin/new-event" className="flex items-center justify-center gap-3 bg-[#0e0e0f] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#c94a20] transition-all active:scale-95 w-full sm:w-auto">
          <Plus size={18} /> <span className="text-[12px] uppercase tracking-widest">Create Vault</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {events.map((event) => {
          const glow = event.themeImageUrl ? glowColors[event.themeImageUrl] : null;
          return (
          <div
            key={event.id}
            className={cn(
              "group relative bg-[#121214] border border-white/5 p-8 rounded-[32px] transition-all duration-500",
              event.themeImageUrl
                ? "hover:border-[rgba(var(--card-glow),0.4)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_40px_rgba(var(--card-glow),0.12)]"
                : "hover:border-[#c94a20]/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            )}
            style={event.themeImageUrl ? ({ "--card-glow": glow || "201,74,32" } as CSSProperties) : undefined}
          >
            {event.themeImageUrl && (
              <div
                className="absolute inset-0 rounded-[32px] opacity-[0.12] transition-opacity duration-700 group-hover:opacity-[0.20] shadow-inner"
                style={{
                  backgroundImage: `url('/api/upload/view?key=${event.themeImageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-t from-[#121214] via-transparent to-transparent" />
            <div className="relative z-10">
              <button onClick={() => { setEditingEvent(event); setTitle(event.title); setThemeImageUrl(event.themeImageUrl || ""); }}
                      className="absolute top-0 right-0 p-2 text-white/20 hover:text-[#c94a20] transition-colors">
                <Settings size={18} />
              </button>
              <Link href={`/admin/${event.id}/overview`} className="block">
                <div
                  className={cn(
                    "relative mb-8 w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 transition-all duration-500 shadow-inner",
                    event.themeImageUrl
                      ? "group-hover:border-[rgba(var(--card-glow),0.5)] group-hover:shadow-[0_0_20px_rgba(var(--card-glow),0.3)]"
                      : "group-hover:border-[#c94a20]/50 group-hover:shadow-[0_0_20px_rgba(201,74,32,0.25)]"
                  )}
                >
                  {event.topPersonImageKey ? (
                    <NextImage
                      src={`/api/upload/view?key=${event.topPersonImageKey}`}
                      fill
                      sizes="256px"
                      className="object-cover object-center"
                      alt="Most photographed guest"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center group-hover:bg-[#c94a20] transition-colors duration-500">
                      <Activity size={20} className="text-white/70 group-hover:text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-6 tracking-tight">{event.title}</h3>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-white/50 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                    <ImageIcon size={12} className="text-[#c94a20]" /> {event._count?.assets || 0}
                  </div>
                </div>
              </Link>
            </div>
          </div>
          );
        })}
      </div>

      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="max-w-md bg-[#0e0e0f] border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
          <DialogTitle className="text-xl font-serif font-bold text-white mb-6">Edit Vault Settings</DialogTitle>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Vault Name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:border-[#c94a20] outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Theme Background</label>
              {editingEvent && <ThemePicker eventId={editingEvent.id} current={themeImageUrl} onSelect={setThemeImageUrl} />}
            </div>

            <button onClick={saveSettings} className="w-full bg-[#c94a20] text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#e05325] transition-all shadow-[0_0_20px_rgba(201,74,32,0.2)]">
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}