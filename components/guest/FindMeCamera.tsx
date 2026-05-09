"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Webcam from "react-webcam";
import { Camera, Loader2, Sparkles, ScanFace, Focus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // <-- Added for cinematic scanner
import { toast } from "sonner"; // <-- Added to replace basic alerts
import { cn } from "@/lib/utils";

export default function FindMeCamera({ eventId }: { eventId: string }) {
  const webcamRef = useRef<Webcam>(null);
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "scanning" | "matching" | "success"
  >("idle");

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      toast.error("Camera Error", {
        description: "Failed to capture image. Check permissions.",
      });
      return;
    }

    setStatus("scanning");

    try {
      // Fake delay for cinematic dramatic effect
      await new Promise((r) => setTimeout(r, 800));
      setStatus("matching");

      const res = await fetch(`/api/events/${eventId}/find-me`, {
        method: "POST",
        body: JSON.stringify({ imageBase64: imageSrc }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.ok) {
        const personId =
          data.personId || data.photos?.[0]?.faceDetections?.[0]?.personId;
        if (personId) {
          setStatus("success");
          toast.success("Identity Verified", {
            description: "Routing to secure gallery...",
          });
          setTimeout(() => {
            router.push(
              `/guest/event/${eventId}/my-photos?personId=${personId}`,
            );
          }, 1200);
        } else {
          setStatus("idle");
          toast.warning("Profile Not Indexed", {
            description:
              "We recognized a face, but you haven't been tagged in the vault yet. Try again later.",
          });
        }
      } else {
        throw new Error(data.error || "Match failed");
      }
    } catch (err) {
      console.error(err);
      setStatus("idle");
      toast.error("Biometric Sync Failed", {
        description: "Could not connect to the AWS resolution engine.",
      });
    }
  }, [webcamRef, eventId, router]);

  return (
    <div className="flex flex-col items-center w-full space-y-8">
      {/* Viewfinder Container */}
      <div
        className={cn(
          "relative w-full max-w-sm aspect-[3/4] sm:aspect-square rounded-[32px] overflow-hidden bg-[#0d0d0f] transition-all duration-700",
          status !== "idle"
            ? "scale-[0.96] shadow-[0_0_50px_rgba(201,74,32,0.25)] border-[#c94a20]/30"
            : "scale-100 shadow-2xl border-white/10",
          "border",
        )}
      >
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={1} // Force 100% quality JPEG, no compression
          videoConstraints={{
            facingMode: "user",
            width: { ideal: 1280 }, // Force HD capture
            height: { ideal: 720 },
          }}
          className={cn(
            "w-full h-full object-cover transition-all duration-700",
            status !== "idle"
              ? "grayscale-[0.8] contrast-150 brightness-75 scale-105"
              : "grayscale-[0.2] contrast-110 scale-100",
          )}
        />

        {status === "idle" && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
            <div className="w-[65%] aspect-[3/4] rounded-[100%] border-2 border-white/30 border-dashed animate-[pulse_3s_ease-in-out_infinite]" />
            <p className="absolute bottom-12 text-white/50 text-[10px] font-mono uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
              Align Face Within Oval
            </p>
          </div>
        )}

        {/* Viewfinder Tactical Brackets */}
        <div
          className={cn(
            "absolute inset-6 pointer-events-none z-10 flex flex-col justify-between transition-opacity duration-500",
            status === "idle" ? "opacity-50" : "opacity-10",
          )}
        >
          <div className="flex justify-between">
            <div className="w-10 h-10 border-t-2 border-l-2 border-white rounded-tl-2xl" />
            <div className="w-10 h-10 border-t-2 border-r-2 border-white rounded-tr-2xl" />
          </div>

          {/* Center Crosshair (Only visible when idle) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <Focus size={48} className="text-white" strokeWidth={1} />
          </div>

          <div className="flex justify-between">
            <div className="w-10 h-10 border-b-2 border-l-2 border-white rounded-bl-2xl" />
            <div className="w-10 h-10 border-b-2 border-r-2 border-white rounded-br-2xl" />
          </div>
        </div>

        {/* Scanning Overlays */}
        <AnimatePresence>
          {status !== "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20"
            >
              {/* Red Tint */}
              <div className="absolute inset-0 bg-[#c94a20]/10 mix-blend-overlay" />

              {/* Framer Motion Scanline */}
              <motion.div
                animate={{ y: ["-100%", "400%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-transparent via-[#c94a20]/50 to-transparent z-30"
              />

              {/* Centered Status HUD */}
              <div className="absolute inset-0 flex items-center justify-center z-40">
                <div className="bg-black/60 backdrop-blur-xl border border-[#c94a20]/40 px-8 py-6 rounded-[24px] flex flex-col items-center gap-4 shadow-2xl">
                  {status === "success" ? (
                    <ScanFace className="w-10 h-10 text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                  ) : (
                    <Loader2 className="w-10 h-10 text-[#c94a20] animate-spin" />
                  )}
                  <div className="text-center">
                    <span className="text-white text-[11px] font-mono font-bold tracking-widest block uppercase">
                      {status === "scanning"
                        ? "Analyzing Vectors"
                        : status === "matching"
                          ? "Querying Vault"
                          : "Identity Verified"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Button */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={capture}
          disabled={status !== "idle"}
          className={cn(
            "group w-full py-5 rounded-[20px] font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden shadow-xl",
            status !== "idle"
              ? "bg-white/5 text-white/30 cursor-wait border border-white/5"
              : "bg-white text-black hover:bg-[#c94a20] hover:text-white active:scale-95 hover:shadow-[0_0_30px_rgba(201,74,32,0.3)]",
          )}
        >
          {status !== "idle" ? (
            <span className="text-[11px] uppercase tracking-widest font-mono">
              Processing Sequence...
            </span>
          ) : (
            <>
              <Camera
                size={20}
                className="transition-transform group-hover:scale-110"
              />
              <span className="text-[13px] uppercase tracking-widest">
                Initiate Scan
              </span>
              <Sparkles
                size={16}
                className="text-[#c94a20] group-hover:text-white transition-colors"
              />
            </>
          )}
        </button>

        <p className="text-[9px] text-white/30 uppercase font-mono tracking-widest text-center flex items-center justify-center gap-1.5">
          <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
          Encrypted by AWS Rekognition
        </p>
      </div>
    </div>
  );
}
