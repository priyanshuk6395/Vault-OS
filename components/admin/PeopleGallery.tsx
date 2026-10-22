"use client";

import { useState, useMemo } from "react";
import { UserCircle2, Loader2, Check, Search, Fingerprint, XCircle, ArrowUpDown, X, ScanFace, Activity, ShieldAlert, Trash2, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortMode = "photos-desc" | "unnamed-first" | "name-asc";

export default function PeopleGallery({
  people: initialPeople,
}: {
  people: any[];
}) {
  const [people, setPeople] = useState(initialPeople);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("photos-desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Inspector State
  const [inspectedPerson, setInspectedPerson] = useState<any | null>(null);
  const [drawerName, setDrawerName] = useState(""); // Dedicated state for the in-drawer editor

  const filteredAndSortedPeople = useMemo(() => {
    let result = people.filter((p) => {
      const name = p.name?.toLowerCase() || "unnamed person";
      const status = p.status?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      return name.includes(query) || status.includes(query);
    });

    result.sort((a, b) => {
      const countA = a._count?.faceDetections || 0;
      const countB = b._count?.faceDetections || 0;
      if (sortBy === "photos-desc") return countB - countA;
      if (sortBy === "unnamed-first") {
        if (a.status === "unnamed" && b.status !== "unnamed") return -1;
        if (b.status === "unnamed" && a.status !== "unnamed") return 1;
        return countB - countA;
      }
      if (sortBy === "name-asc") {
        const nameA = a.name || "zzzz"; 
        const nameB = b.name || "zzzz";
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return result;
  }, [searchQuery, people, sortBy]);

  // Unified Update Function (Works for both Grid and Drawer)
  const handleNameUpdate = async (personId: string, providedName: string, isFromDrawer = false) => {
    if (!providedName.trim()) {
      if (!isFromDrawer) setEditingId(null);
      return;
    }

    setLoadingId(personId);
    const toastId = toast.loading("Updating Identity Registry...");

    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: providedName, status: "named" }),
      });

      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === personId ? { ...p, name: providedName, status: "named" } : p,
          ),
        );
        
        // If drawer is open, update its internal state so it reflects immediately
        if (inspectedPerson?.id === personId) {
            setInspectedPerson({ ...inspectedPerson, name: providedName, status: "named" });
        }

        toast.success("Identity Resolved", {
          id: toastId,
          description: `${providedName.toUpperCase()} has been secured in the vault.`,
          icon: <Fingerprint className="text-accent-teal" size={16} />
        });
      } else {
        throw new Error("Failed to patch database.");
      }
    } catch (err) {
      toast.error("Resolution Failed", { id: toastId });
    } finally {
      setLoadingId(null);
      setEditingId(null);
      setNewName("");
    }
  };

  return (
    <div className="space-y-8 relative">
      
      {/* Search Bar & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="relative w-full sm:max-w-md group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by name or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-subtle border border-input rounded-lg pl-11 pr-4 py-3 text-[13px] font-medium text-foreground outline-none focus:border-primary focus:bg-card focus:shadow-lg focus:shadow-primary/10 transition-all placeholder:text-muted-foreground placeholder:font-normal"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
              <ArrowUpDown size={14} />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="w-full sm:w-auto appearance-none bg-card border border-input rounded-lg pl-9 pr-8 py-2.5 text-[12px] font-bold text-foreground outline-none hover:border-primary transition-colors cursor-pointer shadow-sm focus:border-primary"
            >
              <option value="photos-desc">Most Photos First</option>
              <option value="unnamed-first">Unnamed Priority</option>
              <option value="name-asc">Alphabetical (A-Z)</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Grid */}
      {filteredAndSortedPeople.length > 0 ? (
        <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedPeople.map((person) => {
              const sample = person.samples?.[0]?.faceDetection;
              const box = sample?.boundingBox;
              const faceWidth = box?.Width ?? 0.2;
              const dynamicScale = Math.max(2, Math.min(6, 1.0 / faceWidth));

              return (
                <motion.div 
                  key={person.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(5px)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={() => {
                    setDrawerName(person.name || "");
                    setInspectedPerson(person);
                  }}
                  className="cursor-pointer group flex flex-col items-center"
                >
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-subtle border-2 border-border overflow-hidden transition-all duration-500 group-hover:border-primary group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:-translate-y-1">
                    {person.faceUrl ? (
                      <img
                        src={person.faceUrl}
                        alt="Face"
                        className="absolute w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.1]"
                        style={{
                          transform: `scale(${dynamicScale})`,
                          objectPosition: `${(box?.Left + box?.Width / 2) * 100}% ${(box?.Top + box?.Height / 2) * 100}%`,
                          transformOrigin: `${(box?.Left + box?.Width / 2) * 100}% ${(box?.Top + box?.Height / 2) * 100}%`,
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <UserCircle2 size={48} strokeWidth={1} />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[9px] px-2 py-0.5 rounded-full font-mono shadow-sm z-10 border border-card/20">
                      {person._count.faceDetections}
                    </div>
                  </div>

                  <div className="mt-4 text-center w-full px-1 h-12 flex flex-col justify-center relative">
                    {editingId === person.id ? (
                      <div className="flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center gap-1 w-full bg-card border border-primary rounded-md px-2 py-1 shadow-sm">
                          <input
                            autoFocus
                            className="text-[12px] sm:text-[13px] font-bold text-foreground outline-none bg-transparent w-full text-center font-serif placeholder:text-muted-foreground"
                            placeholder="Identify..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleNameUpdate(person.id, newName)}
                            onBlur={() => !newName && setEditingId(null)}
                          />
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); handleNameUpdate(person.id, newName); }}
                            className="p-1 hover:bg-subtle rounded-md transition-colors"
                          >
                            {loadingId === person.id ? <Loader2 size={14} className="animate-spin text-primary" /> : <Check size={14} className="text-accent-teal" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); 
                            setEditingId(person.id);
                            setNewName(person.name || "");
                          }}
                          className={cn(
                            "text-[14px] sm:text-[15px] font-bold transition-colors truncate w-full font-serif block hover:text-primary",
                            person.status === "named" ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {person.name || "Unnamed Person"}
                        </button>
                        <div className={cn(
                          "text-[9px] font-mono uppercase tracking-widest mt-1",
                          person.status === "named" ? "text-accent-teal" : "text-accent-amber"
                        )}>
                          {person.status}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="text-center py-20 sm:py-32 bg-subtle border border-border border-dashed rounded-xl">
          <XCircle size={32} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-foreground text-[18px] font-serif font-bold">No Matches Found</p>
        </div>
      )}

      {/* 4. THE VAULT OS IDENTITY DOSSIER (SLIDE-OUT INSPECTOR) */}
      <AnimatePresence>
        {inspectedPerson && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectedPerson(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="fixed top-0 right-0 w-[460px] max-w-[100vw] h-[100dvh] bg-card border-l border-border z-[70] shadow-xl flex flex-col text-card-foreground"
            >
              {/* Dossier Header */}
              <div className="p-6 flex justify-between items-start border-b border-border bg-subtle">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                    <ScanFace size={20} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Identity Dossier</h3>
                    <p className="text-[13px] font-mono text-foreground mt-0.5 uppercase tracking-wider">
                      {inspectedPerson.id.split('-')[0]}-NODE
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setInspectedPerson(null)}
                  className="p-2 bg-background rounded-full border border-border hover:bg-subtle hover:text-foreground transition-colors text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Dossier Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* Reference Photo with Scanner Effect */}
                <div className="relative aspect-square bg-subtle rounded-lg overflow-hidden border border-border shadow-inner group">
                  {/* Cinematic Scanner Line */}
                  <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-lg shadow-primary/40 z-20 opacity-50 mix-blend-screen"
                  />
                  {inspectedPerson.faceUrl ? (
                    <img 
                      src={inspectedPerson.faceUrl} 
                      alt="Primary Reference" 
                      className="w-full h-full object-cover filter contrast-125 grayscale-[0.2]" 
                    />
                  ) : (
                    <UserCircle2 size={64} className="absolute inset-0 m-auto text-muted-foreground/30" strokeWidth={1} />
                  )}
                  {/* Tactical Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10 pointer-events-none" />
                  
                  <div className="absolute bottom-4 left-4 z-30 flex gap-2">
                    <span className="px-2 py-1 bg-card/90 backdrop-blur-md rounded border border-border text-[9px] font-mono font-bold uppercase tracking-widest text-accent-teal flex items-center gap-1.5">
                      <Check size={10} /> AI Conf: 99.8%
                    </span>
                  </div>
                </div>

                {/* Identity Editor (IN-DRAWER) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint size={12} /> Registered Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={drawerName}
                      onChange={(e) => setDrawerName(e.target.value)}
                      placeholder="Assign identity..."
                      className="flex-1 bg-background border border-input rounded-md px-4 py-3 text-foreground font-serif text-[18px] focus:border-primary focus:bg-subtle outline-none transition-all placeholder:text-muted-foreground"
                      onKeyDown={(e) => e.key === "Enter" && handleNameUpdate(inspectedPerson.id, drawerName, true)}
                    />
                    <button 
                      onClick={() => handleNameUpdate(inspectedPerson.id, drawerName, true)}
                      disabled={loadingId === inspectedPerson.id || drawerName === inspectedPerson.name}
                      className="p-3.5 bg-primary hover:brightness-110 disabled:bg-subtle disabled:text-muted-foreground text-primary-foreground rounded-md font-bold transition-all"
                    >
                      {loadingId === inspectedPerson.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                  </div>
                </div>

                {/* Telemetry Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-subtle p-4 rounded-lg border border-border flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Activity size={12} /> Total Matches
                    </div>
                    <div className="text-3xl font-bold text-foreground mt-2">{inspectedPerson._count.faceDetections}</div>
                  </div>
                  <div className="bg-subtle p-4 rounded-lg border border-border flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert size={12} /> Status
                    </div>
                    <div className={cn(
                      "text-sm font-bold uppercase mt-2 tracking-widest",
                      inspectedPerson.status === "named" ? "text-accent-teal" : "text-accent-amber"
                    )}>
                      {inspectedPerson.status}
                    </div>
                  </div>
                </div>

              </div>

              {/* Danger Zone */}
{/* Action Zone */}
              <div className="p-6 border-t border-border bg-subtle shrink-0 space-y-3">
                
                {/* 🚀 NEW: Download Button */}
                <button 
                  onClick={() => {
                    setDownloadingId(inspectedPerson.id);
                    window.location.href = `/api/events/${inspectedPerson.eventId}/download-all?personId=${inspectedPerson.id}`;
                    // Cinematic delay to let the stream initialize before resetting the button
                    setTimeout(() => setDownloadingId(null), 3000);
                  }}
                  disabled={downloadingId === inspectedPerson.id || inspectedPerson._count.faceDetections === 0}
                  className="w-full py-3.5 bg-card hover:bg-primary border border-border text-foreground hover:text-primary-foreground font-bold text-[11px] font-mono uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {downloadingId === inspectedPerson.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                  )}
                  {downloadingId === inspectedPerson.id ? "Packing Archive..." : `Download Assets (${inspectedPerson._count.faceDetections})`}
                </button>

                {/* Existing Purge Button */}
                <button 
                  onClick={() => {
                    toast.error("Purge Protocol Required", { description: "You must run a global purge to remove false identities." });
                  }}
                  className="w-full py-3.5 bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-500 hover:text-white font-bold text-[11px] font-mono uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                  <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> Purge Entity from Index
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
} 