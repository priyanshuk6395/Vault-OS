import Link from "next/link";
import { 
  ImageIcon, 
  Video, 
  ScanFace, 
  AlertCircle,
  Activity,
  Cpu,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileImage,
  UserCheck
} from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export default async function OverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  // 1. GOD-LEVEL CONCURRENT FETCHING
  // Added the Event fetch to pull the Vault title alongside the metrics
  const [
    event,
    assetGroups, 
    facesDetected, 
    unnamedPeople, 
    namedPeople,
    pendingModeration,
    recentActivity
  ] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { title: true } }),
    prisma.asset.groupBy({ by: ['assetType'], where: { eventId }, _count: true }),
    prisma.faceDetection.count({ where: { asset: { eventId } } }),
    prisma.person.count({ where: { eventId, status: 'unnamed' } }),
    prisma.person.count({ where: { eventId, status: 'named' } }),
    prisma.asset.count({ where: { eventId, moderationState: 'pending' } }),
    prisma.asset.findMany({
      where: { eventId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, sourceFilename: true, status: true, createdAt: true, assetType: true }
    })
  ]);

  // 2. PARSE & CALCULATE METRICS
  const totalAssets = assetGroups.reduce((acc, curr) => acc + curr._count, 0);
  const images = assetGroups.find(g => g.assetType?.includes('image'))?._count || 0;
  const videos = assetGroups.find(g => g.assetType?.includes('video'))?._count || 0;
  
  const totalPeople = namedPeople + unnamedPeople;
  const resolutionRate = totalPeople > 0 ? Math.round((namedPeople / totalPeople) * 100) : 0;
  const activeJobs = recentActivity.filter(a => a.status === 'processing' || a.status === 'uploaded').length;

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER WITH VAULT NAME & REAL-TIME PING */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h2 className="text-[28px] font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            {event?.title || "Vault"} 
            <span className="text-border font-sans font-normal text-[22px]">/</span> 
            <span className="text-muted-foreground font-sans font-normal text-[22px]">Telemetry</span>
          </h2>
          <p className="text-[13px] text-muted-foreground font-medium mt-1">Live infrastructure overview for Node <span className="font-mono text-primary uppercase">{eventId.slice(0, 8)}</span></p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-teal/10 border border-accent-teal/20 rounded-full shadow-sm shrink-0">
          <div className="w-2 h-2 bg-accent-teal rounded-full animate-ping absolute" />
          <div className="w-2 h-2 bg-accent-teal rounded-full relative" />
          <span className="text-[10px] font-mono text-accent-teal uppercase tracking-widest font-bold">Engine Online</span>
        </div>
      </div>

      {/* TIER 1: PRIMARY METRICS (Staggered Load) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <StatCard title="Total Storage" value={totalAssets} trend={activeJobs > 0 ? `${activeJobs} active I/O jobs` : `System Idle`} color="accent" />
        <StatCard title="Indexed Faces" value={facesDetected} icon={ScanFace} color="blue" />
        <StatCard title="Identified Entities" value={totalPeople} icon={UserCheck} color="green" />
        
        {/* Custom Premium Card for Moderation */}
        <div className={cn(
          "bg-card text-card-foreground border p-5 relative overflow-hidden shadow-sm flex flex-col justify-between transition-all rounded-lg",
          pendingModeration > 0 ? "border-accent-amber/30 bg-accent-amber/10" : "border-border"
        )}>
          {pendingModeration > 0 && <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent-amber" />}
          <div className="flex justify-between items-start">
            <div className="text-[28px] font-serif leading-none text-card-foreground">{pendingModeration}</div>
            <AlertCircle className={cn("w-5 h-5", pendingModeration > 0 ? "text-accent-amber" : "text-muted-foreground")} />
          </div>
          <div>
            <div className="text-[10.5px] font-mono text-muted-foreground uppercase tracking-tight font-bold">Pending Moderation</div>
            {pendingModeration > 0 && (
              <Link href={`/admin/${eventId}/guest-uploads`} className="text-[10px] text-accent-amber hover:underline font-medium mt-1 flex items-center gap-1">
                Review Required &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* TIER 2: BENTO BOX ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
        
        {/* LEFT BENTO: Identity Resolution Engine */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-subtle rounded-lg text-primary"><Cpu size={20} /></div>
            <div>
              <h3 className="text-[16px] font-bold text-foreground tracking-tight">Biometric Resolution</h3>
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">AI Confidence Metrics</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-4xl font-serif font-bold text-foreground">{resolutionRate}%</div>
                <div className="text-[12px] text-muted-foreground font-medium mt-1">Overall Naming Accuracy</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-bold text-accent-teal">{namedPeople} Named</div>
                <div className="text-[13px] font-bold text-accent-amber">{unnamedPeople} Queued</div>
              </div>
            </div>

            {/* Premium Stacked Progress Bar */}
            <div className="w-full h-3 bg-subtle rounded-full overflow-hidden flex shadow-inner">
              <div className="bg-accent-teal h-full transition-all duration-1000" style={{ width: `${resolutionRate}%` }} />
              <div className="bg-accent-amber h-full transition-all duration-1000 opacity-60" style={{ width: `${100 - resolutionRate}%` }} />
            </div>

            {unnamedPeople > 0 && (
              <Link 
                href={`/admin/${eventId}/people`}
                className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground rounded-lg text-[12px] font-bold uppercase tracking-widest text-center transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ScanFace size={16} /> Resolve {unnamedPeople} Identities
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT BENTO: Activity Feed */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-subtle rounded-lg text-muted-foreground"><Activity size={20} /></div>
            <div>
              <h3 className="text-[16px] font-bold text-foreground tracking-tight">Pipeline Feed</h3>
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">Latest Ingestions</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {recentActivity.length > 0 ? recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3 group">
                <div className="relative mt-1 flex flex-col items-center">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full ring-2 ring-white z-10",
                    activity.status === 'processed' ? "bg-accent-teal" : 
                    activity.status === 'failed' ? "bg-accent-coral" : "bg-primary animate-pulse"
                  )} />
                  <div className="w-[1px] h-full bg-border absolute top-2.5 -bottom-4 group-last:hidden" />
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-[13px] font-semibold text-foreground truncate flex items-center gap-2">
                    {activity.assetType === 'image' ? <FileImage size={12} className="text-muted-foreground" /> : <Video size={12} className="text-muted-foreground" />}
                    {activity.sourceFilename || "Unnamed Asset"}
                  </p>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{activity.status}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
                <Clock size={32} className="text-muted-foreground" />
                <p className="text-[12px] font-mono uppercase tracking-widest text-muted-foreground">No Recent Activity</p>
              </div>
            )}
          </div>
          
          <Link 
            href={`/admin/${eventId}/media`}
            className="mt-4 text-center text-[11px] font-bold text-primary uppercase tracking-widest hover:underline"
          >
            View Full Library &rarr;
          </Link>
        </div>
        
      </div>
    </div>
  );
}