"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  ScanFace, 
  LockKeyhole, 
  ChevronRight, 
  Cpu, 
  Zap,
  Fingerprint
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- 1. HERO COMPONENT ---
function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Glowing Orb Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c94a20]/20 rounded-full blur-[120px] pointer-events-none opacity-50 mix-blend-screen" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-md mb-8"
        >
          <div className="w-2 h-2 bg-[#c94a20] rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-white/60 uppercase tracking-[0.2em]">
            Vault OS Online
          </span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white tracking-tight mb-6 leading-tight"
        >
          Biometric Media <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c94a20] to-[#e05325] italic">
            Distribution.
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-white/40 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-mono uppercase tracking-widest mb-12"
        >
          End-to-end encrypted event galleries powered by AWS Rekognition. 
          Guests find their photos instantly via facial vector mapping.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <Link 
            href="/login"
            className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#c94a20] text-white rounded-full font-bold uppercase tracking-widest text-[12px] transition-all hover:bg-[#e05325] shadow-[0_0_40px_rgba(201,74,32,0.3)] hover:shadow-[0_0_60px_rgba(201,74,32,0.5)] active:scale-95"
          >
            <ShieldCheck size={16} />
            Command Center
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <Link 
            href="/admin/new-event"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-full font-bold uppercase tracking-widest text-[12px] hover:bg-white/10 transition-all backdrop-blur-md active:scale-95"
          >
            <Zap size={16} className="text-[#c94a20]" />
            Initialize Vault
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// --- 2. BENTO FEATURES COMPONENT ---
function FeatureBento() {
  const features = [
    {
      title: "AI Face Clustering",
      desc: "Instantaneous vector matching across thousands of assets.",
      icon: ScanFace,
      className: "md:col-span-2 bg-[#121214]",
      accent: "text-[#c94a20]"
    },
    {
      title: "Zero-Trust Security",
      desc: "Passcode-gated portals with AES-256 cloud encryption.",
      icon: LockKeyhole,
      className: "md:col-span-1 bg-[#121214]",
      accent: "text-green-500"
    },
    {
      title: "Edge Compute",
      desc: "Client-side HEIC conversion and compression.",
      icon: Cpu,
      className: "md:col-span-1 bg-[#121214]",
      accent: "text-blue-500"
    },
    {
      title: "Immutable Audits",
      desc: "Track every cryptographic handshake and biometric match.",
      icon: Fingerprint,
      className: "md:col-span-2 bg-[#121214]",
      accent: "text-[#c8b89a]"
    }
  ];

  return (
    <section className="py-20 px-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className={cn(
              "group p-8 rounded-[32px] border border-white/5 relative overflow-hidden transition-all hover:border-white/10 hover:bg-white/[0.03]",
              feat.className
            )}
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <feat.icon size={100} />
            </div>
            <div className="relative z-10">
              <div className={cn("w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-lg", feat.accent)}>
                <feat.icon size={24} />
              </div>
              <h3 className="text-xl font-serif font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-sm font-mono text-white/40 uppercase tracking-widest leading-relaxed max-w-[250px]">
                {feat.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// --- 3. TERMINAL FOOTER COMPONENT ---
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/50 backdrop-blur-xl mt-20">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 opacity-50">
          <ShieldCheck size={16} className="text-white" />
          <span className="text-[10px] font-mono text-white uppercase tracking-[0.2em]">
            Vault OS // Enterprise Grade
          </span>
        </div>
        <div className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
          Engineered by Priyanshu Kumar
        </div>
      </div>
    </footer>
  );
}

// --- MAIN PAGE EXPORT ---
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0d0d0f] font-sans selection:bg-[#c94a20]/30 relative">
      {/* Global Background Texture */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0" 
        style={{ backgroundImage: 'radial-gradient(#c94a20 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
      />
      
      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center max-w-7xl mx-auto left-1/2 -translate-x-1/2">
        <div className="text-[14px] font-serif font-bold text-white tracking-tight flex items-center gap-2">
          <div className="w-2 h-2 bg-[#c94a20] rounded-full" />
          Vault
        </div>
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.3em] border border-white/10 px-3 py-1 rounded-full backdrop-blur-md">
          System Status: Optimal
        </div>
      </nav>

      {/* Assembly of Components */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <HeroSection />
        <FeatureBento />
        <div className="flex-1" /> {/* Pushes footer to bottom if screen is tall */}
        <Footer />
      </div>
    </main>
  );
}