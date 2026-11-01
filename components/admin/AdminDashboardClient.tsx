"use client";

import { useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { Plus, Activity, Settings, Image as ImageIcon, Check, Search, ArrowUpRight, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface DashboardThemeAsset {
  id: string;
  storageKey: string;
  sourceFilename?: string | null;
}

interface DashboardEvent {
  id: string;
  title: string;
  themeImageUrl: string | null;
  topPersonImageKey?: string | null;
  _count?: { assets?: number; persons?: number };
}

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

function tiltVaultCard(event: ReactPointerEvent<HTMLElement>) {
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (event.pointerType !== "mouse" || reduceMotion) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
  const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
  event.currentTarget.style.setProperty("--card-tilt-x", `${-vertical * 5}deg`);
  event.currentTarget.style.setProperty("--card-tilt-y", `${horizontal * 5}deg`);
}

function resetVaultCard(event: ReactPointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--card-tilt-x", "0deg");
  event.currentTarget.style.setProperty("--card-tilt-y", "0deg");
}

// 1. EXTRACTED PICKER COMPONENT
function ThemePicker({ onSelect, current, eventId }: { onSelect: (key: string) => void, current: string, eventId: string }) {
  const [assets, setAssets] = useState<DashboardThemeAsset[]>([]);
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
          setAssets(Array.isArray(data) ? data as DashboardThemeAsset[] : []);
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
        assets.map((a) => {
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
  events: DashboardEvent[];
}

export default function AdminDashboardClient({ events: initialEvents }: AdminDashboardClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [search, setSearch] = useState("");
  const [editingEvent, setEditingEvent] = useState<DashboardEvent | null>(null);
  const [title, setTitle] = useState("");
  const [themeImageUrl, setThemeImageUrl] = useState("");
  // Keyed by storageKey (not eventId) so a changed theme image always gets re-sampled,
  // while unrelated cards keep their cached color instead of re-fetching.
  const [glowColors, setGlowColors] = useState<Record<string, string>>({});

  useEffect(() => {
    events.forEach((event) => {
      const storageKey = event.themeImageUrl;
      if (storageKey && !glowColors[storageKey]) {
        extractAverageColor(`/api/upload/view?key=${storageKey}`)
          .then((rgb) => setGlowColors((prev) => ({ ...prev, [storageKey]: rgb })))
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

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredEvents = events.filter((event) => event.title.toLocaleLowerCase().includes(normalizedSearch));
  const totalAssets = events.reduce((total, event) => total + (event._count?.assets ?? 0), 0);
  const totalPeople = events.reduce((total, event) => total + (event._count?.persons ?? 0), 0);

  return (
    <>
      <header className="vault-dashboard-heading border-b border-border pb-6 sm:pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-terracotta">
              Media operations / 01
            </p>
            <h1 className="font-serif text-[42px] font-normal tracking-tight text-foreground sm:text-[52px]">
              Command Center
            </h1>
            <p className="mt-2 text-sm text-muted-slate">Search and manage event archives.</p>
          </div>
          <Link href="/admin/new-event" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">
            <Plus size={17} aria-hidden="true" /> Create vault
          </Link>
        </div>

        <div aria-label="Vault totals" className="mt-7 grid grid-cols-3 border-y border-border py-3 sm:mt-8 sm:py-4">
          <div className="pr-3 sm:pr-6">
            <p className="font-serif text-2xl font-normal text-foreground">{events.length}</p>
            <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-slate sm:text-[11px]">Vaults</p>
          </div>
          <div className="border-l border-border px-3 sm:px-6">
            <p className="font-serif text-2xl font-normal text-foreground">{totalAssets.toLocaleString()}</p>
            <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-slate sm:text-[11px]">Media assets</p>
          </div>
          <div className="border-l border-border pl-3 sm:pl-6">
            <p className="font-serif text-2xl font-normal text-foreground">{totalPeople.toLocaleString()}</p>
            <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-slate sm:text-[11px]">People indexed</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="vault-list-heading" className="mt-6 sm:mt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="vault-list-heading" className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
            Event vaults <span className="ml-1 text-muted-slate">{filteredEvents.length}/{events.length}</span>
          </h2>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search event vaults</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-slate" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vaults"
              className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        {events.length === 0 ? (
          <div role="status" className="border border-dashed border-border bg-card px-6 py-14 text-center">
            <h3 className="font-serif text-xl font-semibold text-foreground">No vaults yet</h3>
            <p className="mt-2 text-sm text-muted-slate">Create a vault to start managing event media.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div role="status" className="border border-dashed border-border bg-card px-6 py-12 text-center">
            <h3 className="font-serif text-lg font-semibold text-foreground">No matching vaults</h3>
            <p className="mt-1 text-sm text-muted-slate">Try a different title search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event) => {
              const coverImage = event.themeImageUrl || event.topPersonImageKey;
              return (
                <article
                  key={event.id}
                  onPointerMove={tiltVaultCard}
                  onPointerLeave={resetVaultCard}
                  className="vault-tilt group overflow-hidden rounded-lg border border-border bg-card hover:border-primary/50"
                >
                  <Link href={`/admin/${event.id}/overview`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <div className="vault-tilt-plane relative aspect-[16/8] overflow-hidden bg-subtle">
                      {coverImage ? (
                        <NextImage
                          src={`/api/upload/view?key=${coverImage}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          alt={`${event.title} event cover`}
                        />
                      ) : (
                        <div className="vault-cover-art flex h-full items-center justify-center" aria-hidden="true">
                          <Activity size={28} className="relative z-10 text-foreground/75" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-sm border border-border/70 bg-background/90 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground backdrop-blur-sm">
                        Event archive
                      </span>
                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-sm border border-border/70 bg-background/90 px-2 py-1 font-mono text-[10px] font-semibold text-foreground backdrop-blur-sm">
                        <ImageIcon size={12} aria-hidden="true" className="text-accent-terracotta" />
                        {(event._count?.assets ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="vault-tilt-plane px-4 pb-4 pt-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 break-words font-serif text-2xl font-normal leading-snug text-card-foreground">
                          {event.title}
                        </h3>
                        <ArrowUpRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-muted-slate transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-slate">
                        <span className="inline-flex items-center gap-1.5"><ImageIcon size={12} aria-hidden="true" />{(event._count?.assets ?? 0).toLocaleString()} assets</span>
                        <span className="h-3 w-px bg-border" aria-hidden="true" />
                        <span className="inline-flex items-center gap-1.5"><Users size={12} aria-hidden="true" />{(event._count?.persons ?? 0).toLocaleString()} people</span>
                      </div>
                    </div>
                  </Link>
                  <div className="vault-tilt-plane border-t border-border px-4 py-2">
                    <button
                      type="button"
                      onClick={() => { setEditingEvent(event); setTitle(event.title); setThemeImageUrl(event.themeImageUrl || ""); }}
                      className="inline-flex min-h-9 items-center gap-2 text-xs font-medium text-muted-slate transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Edit ${event.title} settings`}
                    >
                      <Settings size={14} aria-hidden="true" /> Settings
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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