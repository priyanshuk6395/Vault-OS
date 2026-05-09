import { prisma } from "@/lib/prisma";
import { Key, ShieldCheck, Link as LinkIcon, ExternalLink, GlobeLock } from "lucide-react";
import { notFound } from "next/navigation";
import AccessButtons from "@/components/admin/AccessButtons";
import PrivacySettings from "@/components/admin/PrivacySettings";
import Link from "next/link";

export default async function AccessControlPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // 1. Fetch Event & Privacy Settings
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      passcode: true,
      guestUploadPolicy: true,
      biometricSearch: true,
      publicGallery: true,
    },
  });

  if (!event) return notFound();

  // 2. Construct Secure Guest Link
  // Fallback to localhost for local development if the env var isn't set
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:4000";
  const guestLink = `${baseUrl}/guest/event/${eventId}`;

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-serif font-bold text-[#0e0e0f] tracking-tight flex items-center gap-3">
            {event.title} 
            <span className="text-[#dbd8cf] font-sans font-normal text-[22px]">/</span> 
            <span className="text-[#5a5a64] font-sans font-normal text-[22px]">Access Control</span>
          </h2>
          <p className="text-[13px] text-[#5a5a64] mt-1 font-medium">
            Manage guest entry, sharing links, and security protocols.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full shadow-sm shrink-0">
          <GlobeLock size={12} className="text-green-600" />
          <span className="text-[10px] font-mono text-green-700 uppercase tracking-widest font-bold">End-to-End Encrypted</span>
        </div>
      </header>

      {/* BENTO BOX GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 1. PASSCODE CARD (Spans 1 Col) */}
        <div className="bg-white border border-[#dbd8cf] p-6 md:p-8 rounded-[32px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#fdf2e0] rounded-xl text-[#a06010]">
                <Key size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-[#0e0e0f] tracking-tight">Active Passcode</h3>
                <p className="text-[10px] text-[#5a5a64] font-mono uppercase tracking-widest mt-0.5">Entry Requirement</p>
              </div>
            </div>

            <div className="flex items-center justify-center py-8 bg-[#f5f4f0] rounded-[20px] border border-[#dbd8cf]/50 mb-6 relative overflow-hidden group">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              <span className="text-3xl font-mono font-bold tracking-[0.25em] text-[#0e0e0f] relative z-10 selection:bg-[#c94a20] selection:text-white">
                {event.passcode}
              </span>
            </div>
          </div>

          {/* Interactive Actions for Passcode */}
          <AccessButtons eventId={eventId} passcode={event.passcode} guestLink={guestLink} />
        </div>

        {/* 2. GUEST LINK CARD (Spans 2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-[#dbd8cf] p-6 md:p-8 rounded-[32px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#f5f4f0] rounded-xl text-[#0e0e0f]">
                <LinkIcon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-[#0e0e0f] tracking-tight">Guest Portal URL</h3>
                <p className="text-[10px] text-[#5a5a64] font-mono uppercase tracking-widest mt-0.5">Shareable Direct Access</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#f5f4f0] p-4 rounded-[20px] border border-[#dbd8cf]/50">
              <div className="flex-1 w-full bg-white border border-[#dbd8cf] rounded-xl px-4 py-3 overflow-x-auto custom-scrollbar">
                <code className="text-[13px] text-[#c94a20] font-bold whitespace-nowrap">
                  {guestLink}
                </code>
              </div>
              <Link 
                href={guestLink} 
                target="_blank"
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-[#0e0e0f] text-white rounded-xl text-[12px] font-bold uppercase tracking-widest hover:bg-[#c94a20] transition-colors shadow-lg"
              >
                Open Portal <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#f5f4f0] flex items-start gap-3">
             <div className="p-1.5 bg-[#e6f5ee] rounded-md text-[#2a7a4f] shrink-0 mt-0.5"><ShieldCheck size={12} /></div>
             <p className="text-[12px] text-[#5a5a64] leading-relaxed">
               Guests navigating to this link will still be required to enter the <strong className="text-[#0e0e0f]">Active Passcode</strong> and pass the biometric scan to view their photos.
             </p>
          </div>
        </div>

        {/* 3. PRIVACY SETTINGS (Spans Full Width Below) */}
        <div className="md:col-span-2 lg:col-span-3 bg-white border border-[#dbd8cf] p-6 md:p-8 rounded-[32px] shadow-sm flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-[#e6f5ee] rounded-xl text-[#2a7a4f]">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-[16px] text-[#0e0e0f] tracking-tight">Privacy Protocols</h3>
            </div>
            <p className="text-[12px] text-[#5a5a64] leading-relaxed">
              Toggle global permissions for the guest portal. Disabling these will instantly revoke access across all active sessions.
            </p>
          </div>

          <div className="md:w-2/3 bg-[#f5f4f0] p-6 rounded-[24px] border border-[#dbd8cf]/50">
            <PrivacySettings event={event} />
          </div>
        </div>

      </div>
    </div>
  );
}