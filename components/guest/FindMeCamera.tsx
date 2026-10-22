"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaceLivenessDetector } from "@aws-amplify/ui-react-liveness";
import { ThemeProvider, Theme } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import { Loader2, ScanFace, ShieldCheck, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import "@aws-amplify/ui-react/styles.css";

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID || "",
      allowGuestAccess: true,
    },
  },
});

const vaultTheme: Theme = {
  name: "vault-os-theme",
  tokens: {
    colors: {
      background: {
        primary: { value: "var(--background)" },
        secondary: { value: "var(--background-elevated)" },
      },
      primary: {
        10: { value: "var(--accent-lavender)" },
        20: { value: "var(--secondary)" },
        40: { value: "var(--accent-coral)" },
        60: { value: "var(--primary)" },
        80: { value: "var(--primary)" },
        90: { value: "var(--accent-coral)" },
        100: { value: "var(--primary)" },
      },
    },
    components: {
      button: {
        primary: {
          backgroundColor: { value: "{colors.primary.80}" },
          _hover: { backgroundColor: { value: "{colors.primary.90}" } },
        },
      },
    },
  },
};

export default function FindMeCamera({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchSession() {
      try {
        const res = await fetch(`/api/events/${eventId}/liveness/create`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Liveness session request failed");
        const data = await res.json();
        if (!data.sessionId) throw new Error("Liveness session was not created");
        if (isMounted) setSessionError(false);

        // Slight artificial delay so the user sees the cool boot sequence
        setTimeout(() => {
          if (isMounted && data.sessionId) setSessionId(data.sessionId);
        }, 1200);
      } catch (err) {
        if (isMounted) setSessionError(true);
        toast.error("Failed to initialize security protocol.");
      }
    }
    fetchSession();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const handleAnalysisComplete = useCallback(async () => {
    if (!sessionId) return;
    const toastId = toast.loading("Vault Engine: Verifying Biometrics...");

    try {
      const res = await fetch(`/api/events/${eventId}/find-me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (res.ok && data.personId) {
        toast.success("Identity Verified", {
          id: toastId,
          description: "Routing to secure gallery...",
        });
        router.push(
          `/guest/event/${eventId}/my-photos?personId=${data.personId}`,
        );
      } else {
        if (res.status === 403 && data.error?.includes("BREACH")) {
          toast.error("ACCESS DENIED", {
            id: toastId,
            description: "Spoofing attempt blocked & logged.",
          });
        } else {
          toast.warning("Profile Not Indexed", {
            id: toastId,
            description: "You haven't been tagged in the vault yet.",
          });
        }
        setSessionId(null);
      }
    } catch (err) {
      toast.error("Network Error", { id: toastId });
      setSessionId(null);
    }
  }, [sessionId, eventId, router]);

  // 🚀 CINEMATIC LOADING STATE
  if (!sessionId) {
    return (
      <div role={sessionError ? "alert" : "status"} aria-live="polite" className="w-full max-w-sm mx-auto aspect-[3/4] sm:aspect-square bg-card rounded-xl border border-border shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient Glow */}
          <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-[50px] animate-pulse" />

        {/* Scanning Line */}
        <motion.div
          animate={{ y: ["-100%", "400%"] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-transparent via-primary/20 to-transparent z-0"
        />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 border border-primary/50 rounded-full animate-ping" />
            <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center backdrop-blur-md">
              <ScanFace className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h3 className="text-card-foreground font-serif text-lg font-bold tracking-tight mb-2">
            Establishing Uplink
          </h3>

          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
            {sessionError ? (
              <span className="text-accent-coral">Security session unavailable. Refresh to retry.</span>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                Provisioning AWS Session...
              </>
            )}
          </div>

          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                className="w-1.5 h-1.5 bg-primary rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto relative group">
      {/* 🚀 TACTICAL CORNER BRACKETS (Overlays on top of the camera) */}
      <div className="absolute inset-4 pointer-events-none z-10 flex flex-col justify-between transition-opacity duration-1000 opacity-30 group-hover:opacity-60">
        <div className="flex justify-between">
          <div className="w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-2xl" />
          <div className="w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-2xl" />
        </div>
        <div className="flex justify-between items-center px-2">
          <div className="text-[8px] font-mono text-primary uppercase tracking-[0.3em] rotate-[-90deg] origin-left translate-y-8">
            AWS_LIVENESS_V2
          </div>
          <div className="text-[8px] font-mono text-primary uppercase tracking-[0.3em] rotate-[90deg] origin-right translate-y-8">
            AES_256_ENCRYPTED
          </div>
        </div>
        <div className="flex justify-between">
          <div className="w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-2xl" />
          <div className="w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-2xl" />
        </div>
      </div>

      {/* 🚀 AWS LIVENESS DETECTOR */}
      <div className="rounded-xl overflow-y-auto overflow-x-hidden border border-border shadow-lg relative bg-card h-[85dvh] min-h-[650px] max-h-[800px] w-full flex flex-col">
        <ThemeProvider theme={vaultTheme} colorMode={resolvedTheme === "dark" ? "dark" : "light"}>
          <FaceLivenessDetector
            sessionId={sessionId}
            region={process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1"}
            onAnalysisComplete={handleAnalysisComplete}
            disableStartScreen={false}
            onUserCancel={() => setSessionId(null)}
          />
        </ThemeProvider>
      </div>

      {/* Trust Badges */}
      <div className="mt-6 flex justify-center items-center gap-4 text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-accent-teal" /> Secure Frame
        </span>
        <span className="flex items-center gap-1.5">
          <Fingerprint size={12} className="text-primary" /> Zero-Trust
        </span>
      </div>
    </div>
  );
}
