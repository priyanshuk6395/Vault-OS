import { prisma } from "@/lib/prisma";
import { 
  History, 
  Fingerprint, 
  Download, 
  ShieldCheck, 
  ScanFace,
  Terminal,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  Key
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

  // Fetch Network Telemetry (Who signed in)
  const accessLogs = await prisma.accessLog.findMany({
    where: { eventId },
    take: 25,
    orderBy: { createdAt: 'desc' }
  });

  // Fetch Biometric Operations (What the AI did)
  const activities = await prisma.faceDetection.findMany({
    where: { asset: { eventId } },
    take: 25,
    orderBy: { createdAt: 'desc' },
    include: { person: true, asset: true }
  });

  // Helper to parse User-Agent strings server-side
  const getClientInfo = (ua: string | null) => {
    if (!ua) return { Icon: Monitor, label: "Unknown Signature" };
    const lower = ua.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
      return { Icon: Smartphone, label: "Mobile Client" };
    }
    return { Icon: Monitor, label: "Desktop Client" };
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
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
            Immutable ledger of network access and biometric clustering operations.
          </p>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#dbd8cf] text-[#0e0e0f] rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#f5f4f0] transition-all shadow-sm shrink-0">
          <Download size={14} /> Export CSV
        </button>
      </header>

{/* 3. NETWORK TELEMETRY (GUEST SIGN-INS) */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#0e0e0f] flex items-center gap-2 px-1">
          <Globe size={16} className="text-[#c94a20]" /> Network Telemetry
        </h3>
        
        <div className="bg-white border border-[#dbd8cf] rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f5f4f0] border-b border-[#eceae4] text-[10px] uppercase font-mono text-[#c8b89a] tracking-widest">
                <tr>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Identity & Protocol</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Origin IP</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Client Signature</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap text-right">UTC Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceae4]">
                {accessLogs.map((log) => {
                  const { Icon, label } = getClientInfo(log.userAgent);
                  const isAdmin = log.action === "ADMIN_ACCESS";
                  const isBiometric = log.action === "BIOMETRIC_VERIFIED";
                  
                  return (
                    <tr key={log.id} className="hover:bg-[#fcfaf7] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            isAdmin ? "bg-[#0e0e0f] text-white" : 
                            isBiometric ? "bg-[#fdf2e0] text-[#a06010]" : "bg-[#e6f5ee] text-[#2a7a4f]"
                          )}>
                            {isAdmin ? <ShieldCheck size={16} /> : isBiometric ? <ScanFace size={16} /> : <Key size={16} />}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[#0e0e0f]">
                              {log.userName || (isAdmin ? "System Admin" : "Guest Participant")}
                            </div>
                            <div className="text-[9px] font-mono text-[#5a5a64] uppercase tracking-widest mt-0.5">
                              {isAdmin ? "Admin Auth / Direct" : isBiometric ? "Biometric AI Match" : "Passcode Verified"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-[12px] text-[#0e0e0f] font-semibold">
                          {log.ipAddress || "ANONYMOUS"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-[#c8b89a] shrink-0" />
                          <div>
                            <div className="text-[12px] font-medium text-[#0e0e0f]">{label}</div>
                            <div className="text-[10px] text-[#5a5a64] truncate max-w-[250px]" title={log.userAgent || ""}>
                              {log.userAgent?.split(' ')[0] || "Unknown"}
                            </div>
                          </div>
                        </div>
                      </td>
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
                {accessLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-[#5a5a64] text-[13px] font-medium">No network access recorded.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. BIOMETRIC LEDGER (AI OPERATIONS) */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#0e0e0f] flex items-center gap-2 px-1">
          <ScanFace size={16} className="text-[#c94a20]" /> Biometric Ledger
        </h3>
        
        <div className="bg-white border border-[#dbd8cf] rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f5f4f0] border-b border-[#eceae4] text-[10px] uppercase font-mono text-[#c8b89a] tracking-widest">
                <tr>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Event Signature</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Subject Identity</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">AI Confidence</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap text-right">UTC Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceae4]">
                {activities.map((log) => {
                  const confidence = Math.round(log.confidence);
                  const isHighConfidence = confidence >= 95;
                  const isUnnamed = log.person?.status === "unnamed";
                  const box = log.boundingBox ? (log.boundingBox as any) : { Top: 0, Left: 0 };

                  return (
                    <tr key={log.id} className="hover:bg-[#fcfaf7] transition-colors group">
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
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-semibold text-[#0e0e0f]">
                          {log.person?.name || <span className="text-[#a06010] italic">Awaiting Resolution</span>}
                        </div>
                        <div className="text-[9px] font-mono text-[#c8b89a] uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                          <ShieldCheck size={10} /> {log.faceId.split('-')[0]}
                        </div>
                      </td>
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
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-[#5a5a64] text-[13px] font-medium">System ledger is empty.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}