import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { Plus, Image as ImageIcon, Users, ChevronRight, Activity, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import DashboardGreeting from "@/components/admin/DashboardGreeting";

export default async function AdminDashboard() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const events = await prisma.event.findMany({
    include: {
      _count: {
        select: { assets: true, persons: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:p-8 space-y-8 sm:space-y-10 animate-in fade-in duration-700">
      
      {/* Invisible component triggers the Sonner Toast on load */}
      <DashboardGreeting userName={session.user?.name || "Admin"} />

      {/* Responsive Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#e6f5ee] border border-[#2a7a4f]/20 rounded-full shadow-sm mb-4 sm:mb-6">
            <ShieldCheck size={12} className="text-[#2a7a4f]" />
            <span className="text-[10px] font-mono text-[#2a7a4f] uppercase tracking-widest font-bold">Authorized Session</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[#0e0e0f] tracking-tight">Command Center</h1>
          <p className="text-[#5a5a64] font-medium mt-2 text-sm sm:text-base">Managing {events.length} biometric vaults across the network.</p>
        </div>
        <Link 
          href="/admin/new-event" 
          className="flex items-center justify-center gap-3 bg-[#0e0e0f] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#c94a20] transition-all shadow-xl shadow-black/10 active:scale-95 w-full sm:w-auto shrink-0"
        >
          <Plus size={18} />
          <span className="text-[12px] uppercase tracking-widest">Create Vault</span>
        </Link>
      </header>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {events.map((event) => (
          <Link 
            key={event.id} 
            href={`/admin/${event.id}/overview`} // Routes to Overview instead of Media
            className="group relative bg-white border border-[#dbd8cf] p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] transition-all duration-500 hover:shadow-2xl hover:shadow-[#c94a20]/15 hover:-translate-y-1 flex flex-col"
          >
            <div className="flex justify-between items-start mb-8 sm:mb-12">
              <div className="p-3 sm:p-4 bg-[#f5f4f0] rounded-xl sm:rounded-2xl group-hover:bg-[#c94a20] group-hover:text-white transition-colors duration-500 shadow-sm">
                <Activity size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="w-8 h-8 rounded-full bg-[#f5f4f0] flex items-center justify-center group-hover:bg-[#c94a20] transition-colors duration-500">
                <ChevronRight size={16} className="text-[#dbd8cf] group-hover:text-white transition-colors" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-[#0e0e0f] mb-4 line-clamp-1">{event.title}</h3>
              
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-auto">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold text-[#5a5a64] uppercase tracking-widest bg-[#f5f4f0] px-3 py-1.5 rounded-lg border border-[#dbd8cf]/50">
                  <ImageIcon size={12} className="text-[#c94a20]" /> {event._count.assets}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold text-[#5a5a64] uppercase tracking-widest bg-[#f5f4f0] px-3 py-1.5 rounded-lg border border-[#dbd8cf]/50">
                  <Users size={12} className="text-[#c94a20]" /> {event._count.persons}
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
              <Plus size={120} />
            </div>
          </Link>
        ))}

        {/* Empty State */}
        {events.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-20 sm:py-32 bg-white border border-[#dbd8cf] border-dashed rounded-[32px]">
            <Activity size={32} className="mx-auto text-[#dbd8cf] mb-4" />
            <h3 className="text-lg font-serif font-bold text-[#0e0e0f]">No Vaults Online</h3>
            <p className="text-[#5a5a64] text-sm mt-1">Initialize your first biometric vault to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}