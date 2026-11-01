import type { Metadata, Viewport } from "next"; // <-- 1. Import Viewport
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ThemeProvider from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
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
  themeColor: "#f7f4ee",
  colorScheme: "light dark",
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
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body 
        className={cn(
          geistSans.variable, 
          geistMono.variable, 
          instrumentSerif.variable,
          "antialiased bg-background text-foreground min-h-screen flex flex-col selection:bg-primary/20"
        )}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}