import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PasscodeGate from "@/components/guest/PasscodeGate";
import FindMeCamera from "@/components/guest/FindMeCamera";
import { ShieldCheck } from "lucide-react";

export default async function GuestEntryPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const cookieStore = await cookies();
  
  // 1. SECURE AUTH CHECK
  const isAuthorized = cookieStore.has(`event_auth_${eventId}`);

  // 2. FETCH EVENT DATA
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, id: true }
  });

  if (!event) return notFound();

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0f] text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#c94a20]/30 relative overflow-hidden">
      
      {/* 1. OS Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#c94a20 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
           
      {/* 2. Cinematic Glowing Orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#c94a20]/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none mix-blend-screen z-0" />

      <div className="w-full max-w-xl relative z-10 my-8">
        {!isAuthorized ? (
          <PasscodeGate 
            eventId={eventId} 
            eventTitle={event.title} 
          />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <header className="text-center mb-10 sm:mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-md shadow-xl">
                <ShieldCheck size={12} className="text-green-500" />
                <span className="text-[9px] sm:text-[10px] font-mono text-white/70 uppercase tracking-[0.2em] font-bold">Secure Link Established</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold tracking-tight text-white mb-4 drop-shadow-lg">
                {event.title}
              </h1>
              <p className="text-white/40 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em]">
                Facial Recognition Engine Ready
              </p>
            </header>
            
            {/* Glassmorphic Camera Container */}
            <div className="bg-white/[0.02] border border-white/5 p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] backdrop-blur-xl shadow-2xl relative overflow-hidden">
              {/* Subtle top glare effect */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              <FindMeCamera eventId={eventId} />
            </div>
          </div>
        )}
      </div>

      {/* Subtle Vault OS Watermark */}
      <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none z-0">
        <span className="text-white/10 text-[9px] font-mono uppercase tracking-[0.3em]">Powered by Vault OS</span>
      </div>
    </main>
  );
}