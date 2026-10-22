"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronDown, Globe, Plus, Command, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateEventModal from "./CreateEventModal";

export default function EventSwitcher() {
  const router = useRouter();
  const params = useParams();
  const currentEventId = params.eventId;

  const [events, setEvents] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadEvents() {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    }
    loadEvents();

    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeEvent = events.find((e) => e.id === currentEventId);

  return (
    <>
      <div className="relative px-3 py-4 border-b border-border" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 group",
            isOpen ? "bg-subtle ring-1 ring-border" : "bg-background hover:bg-subtle"
          )}
        >
          <div className="flex items-center gap-3 truncate">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
              <Command size={14} />
            </div>
            <div className="text-left truncate">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.1em] leading-none mb-1">
                Active Vault
              </div>
              <div className="text-[12.5px] font-bold text-foreground group-hover:text-foreground transition-colors truncate leading-none">
                {activeEvent?.title || "Select Event"}
              </div>
            </div>
          </div>
          <ChevronDown
            size={14}
            className={cn(
              "text-muted-foreground transition-transform duration-300 ease-in-out shrink-0",
              isOpen ? "rotate-180 text-foreground" : "group-hover:text-foreground"
            )}
          />
        </button>

        {/* --- DROPDOWN MENU --- */}
        {isOpen && (
          <div className="absolute left-3 right-3 mt-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-[280px] overflow-y-auto py-2 custom-scrollbar">
              <div className="px-3 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-widest border-b border-border mb-1">
                Your Vaults
              </div>
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/admin/${event.id}/overview`);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-[12.5px] flex items-center justify-between group transition-all",
                    event.id === currentEventId 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:bg-subtle hover:text-foreground"
                  )}
                >
                  <span className="truncate">{event.title}</span>
                  {event.id === currentEventId && <Check size={14} className="shrink-0" />}
                </button>
              ))}
            </div>

            {/* --- ACTION FOOTER --- */}
            <div className="border-t border-border bg-subtle p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full px-3 py-2.5 rounded-lg text-[12px] text-foreground hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-3 group"
              >
                <div className="w-6 h-6 rounded-md bg-background flex items-center justify-center group-hover:bg-primary-foreground/20">
                  <Plus size={14} />
                </div>
                <span className="font-semibold">Create New Vault</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}