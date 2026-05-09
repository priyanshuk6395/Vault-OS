import { prisma } from "@/lib/prisma";
import { 
  History, 
  Fingerprint, 
  Download, 
  ShieldCheck, 
  ScanFace,
  Terminal,
  Clock
} from "lucide-react";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";

export default async function AuditLogsPage({ 
  params 
}: { 
  params: Promise<{ eventId: string }> 
}) {
  const { eventId } = await params;

  // 1. FETCH EVENT & LOGS SCOPED SECURELY
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true }
  });

  if (!event) return notFound();

  // Fetching the last 50 biometric operations for this specific vault
  const activities = await prisma.faceDetection.findMany({
    where: { asset: { eventId } },
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { person: true, asset: true }
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* 2. ENTERPRISE HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#dbd8cf] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-[#0e0e0f] text-white text-[10px] font-mono rounded uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Terminal size={12} /> System Logs
            </span>
          </div>
          <h2 className="text-[28px] font-serif font-bold text-[#0e0e0f] tracking-tight flex items-center gap-3">
            {event.title}
            <span className="text-[#dbd8cf] font-sans font-normal text-[22px]">/</span> 
            <span className="text-[#5a5a64] font-sans font-normal text-[22px]">Security Audit</span>
          </h2>
          <p className="text-[13px] text-[#5a5a64] mt-1 font-medium">
            Immutable ledger of biometric verifications and identity clustering operations.
          </p>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#dbd8cf] text-[#0e0e0f] rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#f5f4f0] transition-all shadow-sm shrink-0">
          <Download size={14} /> Export CSV
        </button>
      </header>

      {/* 3. THE TELEMETRY GRID */}
      <div className="bg-white border border-[#dbd8cf] rounded-[24px] shadow-sm overflow-hidden">
        
        {/* Table Controls / Filters (Visual Mockup for Polish) */}
        <div className="bg-[#f5f4f0] px-6 py-3 border-b border-[#dbd8cf] flex items-center justify-between">
           <div className="flex items-center gap-4 text-[11px] font-mono text-[#5a5a64] uppercase tracking-widest">
             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#2a7a4f]" /> Success</div>
             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#c94a20]" /> Flagged</div>
           </div>
           <div className="text-[10px] font-mono text-[#c8b89a] uppercase tracking-widest">
             Showing latest 50 records
           </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-[#eceae4] text-[10px] uppercase font-mono text-[#c8b89a] tracking-widest">
              <tr>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Event Signature</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Subject Identity</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">AI Confidence</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Resource Hash</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">UTC Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceae4]">
              {activities.map((log) => {
                const confidence = Math.round(log.confidence);
                const isHighConfidence = confidence >= 95;
                const isUnnamed = log.person?.status === "unnamed";
                // Parsing AWS bounding box safely
                const box = log.boundingBox ? (log.boundingBox as any) : { Top: 0, Left: 0 };

                return (
                  <tr key={log.id} className="hover:bg-[#fcfaf7] transition-colors group">
                    
                    {/* EVENT SIGNATURE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          isUnnamed ? "bg-[#fdf2e0] text-[#a06010]" : "bg-[#e6f5ee] text-[#2a7a4f]"
                        )}>
                          {isUnnamed ? <ScanFace size={16} /> : <Fingerprint size={16} />}
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-[#0e0e0f]">
                            {isUnnamed ? "Face Indexed" : "Identity Verified"}
                          </div>
                          <div className="text-[9px] font-mono text-[#5a5a64] uppercase tracking-widest mt-0.5">
                            BBOX: [{box.Left?.toFixed(2)}, {box.Top?.toFixed(2)}]
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SUBJECT IDENTITY */}
                    <td className="px-6 py-4">
                      <div className="text-[13px] font-semibold text-[#0e0e0f]">
                        {log.person?.name || <span className="text-[#a06010] italic">Awaiting Resolution</span>}
                      </div>
                      <div className="text-[9px] font-mono text-[#c8b89a] uppercase tracking-widest mt-0.5">
                        PID: {log.personId.split('-')[0]}
                      </div>
                    </td>

                    {/* AI CONFIDENCE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[12px] font-mono font-bold",
                          isHighConfidence ? "text-[#2a7a4f]" : "text-[#c94a20]"
                        )}>
                          {confidence}%
                        </span>
                        <div className="w-16 h-1.5 bg-[#eceae4] rounded-full overflow-hidden shrink-0">
                           <div 
                             className={cn("h-full rounded-full", isHighConfidence ? "bg-[#2a7a4f]" : "bg-[#c94a20]")}
                             style={{ width: `${confidence}%` }}
                           />
                        </div>
                      </div>
                    </td>

                    {/* RESOURCE HASH */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[#c8b89a] shrink-0" />
                        <span className="font-mono text-[11px] text-[#5a5a64] bg-[#f5f4f0] px-2 py-1 rounded border border-[#dbd8cf]">
                          {log.faceId.split('-')[0]}...{log.faceId.slice(-4)}
                        </span>
                      </div>
                    </td>

                    {/* TIMESTAMP */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-[#5a5a64]">
                        <Clock size={12} className="text-[#c8b89a] group-hover:text-[#c94a20] transition-colors" />
                        <span className="font-mono text-[11px]">
                          {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                        </span>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {activities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <History className="mx-auto text-[#dbd8cf] mb-3" size={32} />
                    <p className="text-[#5a5a64] text-[14px] font-medium">System ledger is empty.</p>
                    <p className="text-[#c8b89a] text-[11px] mt-1 font-mono uppercase tracking-widest">Awaiting biometric ingestion</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}