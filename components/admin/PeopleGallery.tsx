"use client";

import { useState, useMemo } from "react";
import { UserCircle2, Loader2, Check, Search, Fingerprint, XCircle, ArrowUpDown, X, ScanFace, Activity, ShieldAlert, Trash2 } from "lucide-react";
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
          icon: <Fingerprint className="text-[#2a7a4f]" size={16} />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#eceae4]">
        <div className="relative w-full sm:max-w-md group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#c8b89a] group-focus-within:text-[#c94a20] transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by name or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f5f4f0] border border-[#dbd8cf] rounded-2xl pl-11 pr-4 py-3 text-[13px] font-medium outline-none focus:border-[#c94a20] focus:bg-white focus:shadow-lg focus:shadow-[#c94a20]/10 transition-all placeholder:text-[#c8b89a] placeholder:font-normal"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#5a5a64]">
              <ArrowUpDown size={14} />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="w-full sm:w-auto appearance-none bg-white border border-[#dbd8cf] rounded-xl pl-9 pr-8 py-2.5 text-[12px] font-bold text-[#0e0e0f] outline-none hover:border-[#c94a20] transition-colors cursor-pointer shadow-sm focus:border-[#c94a20]"
            >
              <option value="photos-desc">Most Photos First</option>
              <option value="unnamed-first">Unnamed Priority</option>
              <option value="name-asc">Alphabetical (A-Z)</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[#c8b89a]">
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
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#f5f4f0] border-2 border-[#dbd8cf] overflow-hidden transition-all duration-500 group-hover:border-[#c94a20] group-hover:shadow-xl group-hover:shadow-[#c94a20]/20 group-hover:-translate-y-1">
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
                      <div className="flex items-center justify-center h-full text-[#dbd8cf]">
                        <UserCircle2 size={48} strokeWidth={1} />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-[#0e0e0f] text-white text-[9px] px-2 py-0.5 rounded-full font-mono shadow-sm z-10 border border-white/20">
                      {person._count.faceDetections}
                    </div>
                  </div>

                  <div className="mt-4 text-center w-full px-1 h-12 flex flex-col justify-center relative">
                    {editingId === person.id ? (
                      <div className="flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center gap-1 w-full bg-white border border-[#c94a20] rounded-lg px-2 py-1 shadow-sm">
                          <input
                            autoFocus
                            className="text-[12px] sm:text-[13px] font-bold text-[#0e0e0f] outline-none bg-transparent w-full text-center font-serif placeholder:text-[#dbd8cf]"
                            placeholder="Identify..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleNameUpdate(person.id, newName)}
                            onBlur={() => !newName && setEditingId(null)}
                          />
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); handleNameUpdate(person.id, newName); }}
                            className="p-1 hover:bg-[#f5f4f0] rounded-md transition-colors"
                          >
                            {loadingId === person.id ? <Loader2 size={14} className="animate-spin text-[#c94a20]" /> : <Check size={14} className="text-[#2a7a4f]" />}
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
                            "text-[14px] sm:text-[15px] font-bold transition-colors truncate w-full font-serif block hover:text-[#c94a20]",
                            person.status === "named" ? "text-[#0e0e0f]" : "text-[#5a5a64]"
                          )}
                        >
                          {person.name || "Unnamed Person"}
                        </button>
                        <div className={cn(
                          "text-[9px] font-mono uppercase tracking-widest mt-1",
                          person.status === "named" ? "text-[#2a7a4f]" : "text-[#a06010]"
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
        <div className="text-center py-20 sm:py-32 bg-[#f5f4f0]/50 border border-[#dbd8cf] border-dashed rounded-[32px]">
          <XCircle size={32} className="mx-auto text-[#dbd8cf] mb-4" />
          <p className="text-[#0e0e0f] text-[18px] font-serif font-bold">No Matches Found</p>
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
              className="fixed top-0 right-0 w-[460px] max-w-[100vw] h-[100dvh] bg-[#0d0d0f] border-l border-white/10 z-[70] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] flex flex-col text-white"
            >
              {/* Dossier Header */}
              <div className="p-6 flex justify-between items-start border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#c94a20]/10 text-[#c94a20] rounded-lg border border-[#c94a20]/20">
                    <ScanFace size={20} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/40">Identity Dossier</h3>
                    <p className="text-[13px] font-mono text-white/80 mt-0.5 uppercase tracking-wider">
                      {inspectedPerson.id.split('-')[0]}-NODE
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setInspectedPerson(null)}
                  className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/20 hover:text-white transition-colors text-white/50"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Dossier Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* Reference Photo with Scanner Effect */}
                <div className="relative aspect-square bg-[#1a1a1c] rounded-2xl overflow-hidden border border-white/10 shadow-inner group">
                  {/* Cinematic Scanner Line */}
                  <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute top-0 left-0 w-full h-[2px] bg-[#c94a20] shadow-[0_0_20px_#c94a20] z-20 opacity-50 mix-blend-screen"
                  />
                  {inspectedPerson.faceUrl ? (
                    <img 
                      src={inspectedPerson.faceUrl} 
                      alt="Primary Reference" 
                      className="w-full h-full object-cover filter contrast-125 grayscale-[0.2]" 
                    />
                  ) : (
                    <UserCircle2 size={64} className="absolute inset-0 m-auto text-white/10" strokeWidth={1} />
                  )}
                  {/* Tactical Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10 pointer-events-none" />
                  
                  <div className="absolute bottom-4 left-4 z-30 flex gap-2">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[9px] font-mono font-bold uppercase tracking-widest text-[#2a7a4f] flex items-center gap-1.5">
                      <Check size={10} /> AI Conf: 99.8%
                    </span>
                  </div>
                </div>

                {/* Identity Editor (IN-DRAWER) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint size={12} /> Registered Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={drawerName}
                      onChange={(e) => setDrawerName(e.target.value)}
                      placeholder="Assign identity..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-serif text-[18px] focus:border-[#c94a20] focus:bg-white/10 outline-none transition-all placeholder:text-white/20"
                      onKeyDown={(e) => e.key === "Enter" && handleNameUpdate(inspectedPerson.id, drawerName, true)}
                    />
                    <button 
                      onClick={() => handleNameUpdate(inspectedPerson.id, drawerName, true)}
                      disabled={loadingId === inspectedPerson.id || drawerName === inspectedPerson.name}
                      className="p-3.5 bg-[#c94a20] hover:bg-[#e05325] disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl font-bold transition-all"
                    >
                      {loadingId === inspectedPerson.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                  </div>
                </div>

                {/* Telemetry Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity size={12} /> Total Matches
                    </div>
                    <div className="text-3xl font-bold text-white mt-2">{inspectedPerson._count.faceDetections}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col justify-between">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert size={12} /> Status
                    </div>
                    <div className={cn(
                      "text-sm font-bold uppercase mt-2 tracking-widest",
                      inspectedPerson.status === "named" ? "text-[#2a7a4f]" : "text-[#a06010]"
                    )}>
                      {inspectedPerson.status}
                    </div>
                  </div>
                </div>

              </div>

              {/* Danger Zone */}
              <div className="p-6 border-t border-white/10 bg-black/20 shrink-0">
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