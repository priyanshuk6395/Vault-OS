"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef } from "react";
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

const CREATOR_NAME = process.env.NEXT_PUBLIC_CREATOR_NAME || "😇";

const heroContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 }
  }
};

const heroItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
  }
};

// --- 1. HERO COMPONENT ---
function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  // Subtle parallax: content drifts up and fades as you scroll past the hero.
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={sectionRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Glowing Orb Background — now breathing continuously instead of static */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c94a20]/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
        animate={{
          opacity: [0.35, 0.6, 0.35],
          scale: [1, 1.12, 1]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Scanning line sweep — a nod to the biometric-scan theme */}
      <motion.div
        className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-[#c94a20]/60 to-transparent pointer-events-none"
        initial={{ top: "20%" }}
        animate={{ top: ["10%", "90%", "10%"] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        style={{ y, opacity }}
        variants={heroContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center"
      >
        <motion.div
          variants={heroItem}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-md mb-8"
        >
          <motion.div
            className="w-2 h-2 bg-[#c94a20] rounded-full"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-[10px] font-mono text-white/60 uppercase tracking-[0.2em]">
            Vault OS Online
          </span>
        </motion.div>

        <motion.h1
          variants={heroItem}
          className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white tracking-tight mb-6 leading-tight"
        >
          Biometric Media <br className="hidden md:block" />
          <motion.span
            className="inline-block text-transparent bg-clip-text bg-[length:200%_auto] bg-gradient-to-r from-[#c94a20] via-[#e05325] to-[#c94a20] italic"
            animate={{ backgroundPosition: ["0% center", "200% center"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          >
            Distribution.
          </motion.span>
        </motion.h1>

        <motion.p
          variants={heroItem}
          className="text-white/40 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-mono uppercase tracking-widest mb-12"
        >
          End-to-end encrypted event galleries powered by AWS Rekognition.
          Guests find their photos instantly via facial vector mapping.
        </motion.p>

        <motion.div
          variants={heroItem}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} className="w-full sm:w-auto">
            <Link
              href="/login"
              className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-[#c94a20] text-white rounded-full font-bold uppercase tracking-widest text-[12px] transition-shadow hover:bg-[#e05325] shadow-[0_0_40px_rgba(201,74,32,0.3)] hover:shadow-[0_0_60px_rgba(201,74,32,0.5)]"
            >
              <ShieldCheck size={16} />
              Command Center
              <motion.span
                className="inline-flex"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronRight size={16} />
              </motion.span>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} className="w-full sm:w-auto">
            <Link
              href="/admin/new-event"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-full font-bold uppercase tracking-widest text-[12px] hover:bg-white/10 transition-colors backdrop-blur-md"
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex text-[#c94a20]"
              >
                <Zap size={16} />
              </motion.span>
              Initialize Vault
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
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
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6 }}
            className={cn(
              "group p-8 rounded-[32px] border border-white/5 relative overflow-hidden transition-colors hover:border-white/10 hover:bg-white/[0.03]",
              feat.className
            )}
          >
            <motion.div
              className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10"
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ duration: 0.4 }}
            >
              <feat.icon size={100} />
            </motion.div>
            <div className="relative z-10">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className={cn("w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-lg", feat.accent)}
              >
                <feat.icon size={24} />
              </motion.div>
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
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="border-t border-white/10 bg-black/50 backdrop-blur-xl mt-20"
    >
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 opacity-50">
          <ShieldCheck size={16} className="text-white" />
          <span className="text-[10px] font-mono text-white uppercase tracking-[0.2em]">
            Vault OS // Enterprise Grade
          </span>
        </div>
        <div className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
          Engineered by {CREATOR_NAME}
        </div>
      </div>
    </motion.footer>
  );
}

// --- MAIN PAGE EXPORT ---
export default function LandingPage() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-[#0d0d0f] font-sans selection:bg-[#c94a20]/30 relative"
    >
      {/* Global Background Texture — slow drift to keep the page feeling alive */}
      <motion.div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{ backgroundImage: 'radial-gradient(#c94a20 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        animate={{ backgroundPosition: ["0px 0px", "32px 32px"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Top Navigation Bar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center max-w-7xl mx-auto left-1/2 -translate-x-1/2"
      >
        <div className="text-[14px] font-serif font-bold text-white tracking-tight flex items-center gap-2">
          <motion.div
            className="w-2 h-2 bg-[#c94a20] rounded-full"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          Vault
        </div>
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.3em] border border-white/10 px-3 py-1 rounded-full backdrop-blur-md">
          System Status: Optimal
        </div>
      </motion.nav>

      {/* Assembly of Components */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <HeroSection />
        <FeatureBento />
        <div className="flex-1" /> {/* Pushes footer to bottom if screen is tall */}
        <Footer />
      </div>
    </motion.main>
  );
}
