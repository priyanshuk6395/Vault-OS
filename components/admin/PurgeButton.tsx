"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PurgeButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePurge = async () => {
    if (!confirm("This will remove all 'Ghost' identities with no remaining photos. Continue?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/people/purge`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        router.refresh(); // Cleaner than window.location.reload()
      }
    } catch (err) {
      alert("Purge failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePurge}
      disabled={loading}
      className="inline-flex items-center gap-2 text-[10px] font-bold text-[#c94a20] border border-[#c94a20]/20 px-3 py-1.5 rounded-full hover:bg-[#c94a20] hover:text-white transition-all disabled:opacity-50 mt-4"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      Purge Orphans
    </button>
  );
}