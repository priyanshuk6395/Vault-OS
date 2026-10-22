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
  const [loadError, setLoadError] = useState(false);
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/assets/approved`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load approved assets");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setAssets(Array.isArray(data) ? data : []);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const markLoaded = (key: string) =>
    setLoadedKeys((prev) => new Set(prev).add(key));

  return (
    <div
      aria-busy={loading}
      className="grid grid-cols-3 gap-3 h-75 overflow-y-auto overflow-x-hidden custom-scrollbar pr-2"
      style={{ gridAutoRows: "min-content", alignItems: "start" }}
    >
      {loading ? (
        <>
          <span className="sr-only">Loading approved asset thumbnails</span>
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-full rounded-lg bg-subtle border border-border animate-pulse"
              style={{ aspectRatio: "1 / 1" }}
            />
          ))}
        </>
      ) : loadError ? (
        <div role="alert" className="col-span-3 flex items-center justify-center h-full text-center text-[11px] font-mono text-accent-coral uppercase tracking-widest">
          Unable to load approved assets
        </div>
      ) : assets.length === 0 ? (
        <div className="col-span-3 flex items-center justify-center h-full text-center text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
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
                "relative block w-full rounded-lg overflow-hidden border-2 bg-subtle transition-all duration-300 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-inner",
                isSelected
                  ? "border-primary shadow-lg shadow-primary/20"
                  : "border-transparent hover:border-border"
              )}
              style={{ aspectRatio: "1 / 1" }}
              aria-label={`Select theme image ${a.sourceFilename || a.id}`}
              aria-pressed={isSelected}
            >
              {!isLoaded && (
                <div className="absolute inset-0 bg-subtle animate-pulse" />
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
                alt={a.sourceFilename || "Approved event photo"}
              />
              {isSelected && (
                <div className="absolute inset-0 bg-primary/30 flex items-center justify-center z-10">
                  <Check className="text-primary-foreground drop-shadow-md" size={20} />
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
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-foreground">Command Center</h1>
          <p className="text-muted-foreground mt-2 font-medium">Managing {events.length} biometric vaults.</p>
        </div>
        <Link href="/admin/new-event" className="flex items-center justify-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold hover:brightness-110 transition-all active:scale-95 w-full sm:w-auto">
          <Plus size={18} /> <span className="text-[12px] uppercase tracking-widest">Create Vault</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {events.length === 0 ? (
          <div role="status" className="col-span-full border border-dashed border-border rounded-lg bg-card px-6 py-16 text-center">
            <h2 className="font-serif text-xl font-bold text-foreground">No vaults yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create a vault to start managing event media.</p>
          </div>
        ) : events.map((event) => {
          const glow = event.themeImageUrl ? glowColors[event.themeImageUrl] : null;
          return (
          <div
            key={event.id}
            className={cn(
              "group relative bg-card text-card-foreground border border-border p-6 rounded-lg transition-all duration-500",
              event.themeImageUrl
                ? "hover:border-primary/50 hover:shadow-lg"
                : "hover:border-primary/50 hover:shadow-lg"
            )}
            style={event.themeImageUrl ? ({ "--card-glow": glow || "201,74,32" } as CSSProperties) : undefined}
          >
            {event.themeImageUrl && (
              <div
                className="absolute inset-0 rounded-lg opacity-[0.12] transition-opacity duration-700 group-hover:opacity-[0.20] shadow-inner"
                style={{
                  backgroundImage: `url('/api/upload/view?key=${event.themeImageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <div className="absolute inset-0 rounded-lg bg-linear-to-t from-card via-card/70 to-transparent" />
            <div className="relative z-10">
              <button onClick={() => { setEditingEvent(event); setTitle(event.title); setThemeImageUrl(event.themeImageUrl || ""); }}
                      className="absolute top-0 right-0 p-2 text-muted-foreground hover:text-primary transition-colors" aria-label={`Edit ${event.title} settings`}>
                <Settings size={18} />
              </button>
              <Link href={`/admin/${event.id}/overview`} className="block">
                <div
                  className={cn(
                    "relative mb-8 w-16 h-16 rounded-lg overflow-hidden border border-border bg-subtle transition-all duration-500 shadow-inner",
                    event.themeImageUrl
                      ? "group-hover:border-primary/50 group-hover:shadow-lg"
                      : "group-hover:border-primary/50 group-hover:shadow-lg"
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
                    <div className="w-full h-full flex items-center justify-center group-hover:bg-primary transition-colors duration-500">
                      <Activity size={20} className="text-muted-foreground group-hover:text-primary" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-6 tracking-tight">{event.title}</h3>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-muted-foreground bg-subtle px-3 py-1.5 rounded-md border border-border">
                    <ImageIcon size={12} className="text-primary" /> {event._count?.assets || 0}
                  </div>
                </div>
              </Link>
            </div>
          </div>
          );
        })}
      </div>

      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent className="max-w-md bg-card text-card-foreground border border-border p-6 rounded-lg shadow-2xl backdrop-blur-xl">
          <DialogTitle className="text-xl font-serif font-bold text-card-foreground mb-6">Edit Vault Settings</DialogTitle>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest ml-1">Vault Name</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 bg-background border border-input rounded-md text-sm text-foreground focus:border-primary outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest ml-1">Theme Background</label>
              {editingEvent && <ThemePicker eventId={editingEvent.id} current={themeImageUrl} onSelect={setThemeImageUrl} />}
            </div>

            <button onClick={saveSettings} className="w-full bg-primary text-primary-foreground py-3 rounded-md font-bold uppercase tracking-widest text-[11px] hover:brightness-110 transition-all shadow-lg shadow-primary/15">
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}