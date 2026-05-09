import type { Metadata, Viewport } from "next"; // <-- 1. Import Viewport
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 2. METADATA EXPORT (Only SEO & Application data goes here now)
export const metadata: Metadata = {
  title: "Vault OS | Biometric Media Engine",
  description: "End-to-end encrypted event galleries powered by AWS Rekognition. Engineered for secure, instantaneous distribution.",
  generator: "Vault OS",
  applicationName: "Vault OS",
};

// 3. VIEWPORT EXPORT (Theme and scaling data goes here)
export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body 
        className={cn(
          geistSans.variable, 
          geistMono.variable, 
          "antialiased bg-[#0d0d0f] text-white min-h-screen flex flex-col selection:bg-[#c94a20]/30 selection:text-white"
        )}
      >
        {children}
        
        <Toaster 
          position="top-center" 
          theme="dark"
          toastOptions={{
            className: "border border-white/10 bg-black/80 backdrop-blur-2xl text-white shadow-[0_0_40px_rgba(0,0,0,0.5)] font-sans tracking-wide",
            descriptionClassName: "text-white/50 font-mono text-[11px] uppercase tracking-widest mt-1",
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}