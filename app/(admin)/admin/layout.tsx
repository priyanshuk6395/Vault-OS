"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import SideBar from "@/components/admin/SideBar";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { UploadProvider } from "@/context/UploadProvider";
import PipelineHUD from "@/components/admin/PipelineHUD";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fullScreenRoutes = ["/admin", "/admin/new-event", "/admin/new"];
  const isMainDashboard = fullScreenRoutes.includes(pathname);

  // Close the mobile menu automatically AND fire the telemetry tracker
useEffect(() => {
    setIsMobileMenuOpen(false);

    // 🕵️‍♂️ SILENT ADMIN TELEMETRY TRACKER (Throttled)
    if (!isMainDashboard && pathname) {
      const eventId = pathname.split('/')[2]; 
      
      if (eventId && eventId !== 'new-event' && eventId !== 'new') {
        const telemetryKey = `telemetry_logged_${eventId}`;
        
        // Only log if we haven't already logged this event in this browser session
        if (!sessionStorage.getItem(telemetryKey)) {
          fetch('/api/admin/log-telemetry', {
            method: 'POST',
            body: JSON.stringify({ eventId }),
            headers: { "Content-Type": "application/json" }
          }).catch((err) => {
            console.warn("[Telemetry] Silent ping failed", err);
          });
          
          sessionStorage.setItem(telemetryKey, "true");
        }
      }
    }
  }, [pathname, isMainDashboard]);

  return (
    <UploadProvider>
      <div
        className={cn(
          "flex h-dvh font-sans transition-colors duration-500 overflow-hidden relative",
          "bg-background text-foreground",
        )}
      >
        {/* 1. MOBILE SIDEBAR BACKDROP */}
        {!isMainDashboard && (
          <div
            className={cn(
              "fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden transition-all duration-300",
              isMobileMenuOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* 2. RESPONSIVE SIDEBAR WRAPPER */}
        {!isMainDashboard && (
          <div
            className={cn(
              "fixed inset-y-0 left-0 w-56 shrink-0 transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none z-50",
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SideBar onClose={() => setIsMobileMenuOpen(false)}/>

            {/* Mobile Close Button - Hides seamlessly when menu is closed */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "absolute top-4 -right-12 p-2 bg-card text-foreground rounded-r-xl lg:hidden shadow-lg border border-l-0 border-border transition-opacity duration-300",
                isMobileMenuOpen
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none",
              )}
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* 3. MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Context-Aware Header */}
          <header
            className={cn(
              "h-15 sm:h-17.5 shrink-0 flex items-center justify-between px-4 sm:px-8 z-10 transition-all duration-500",
              "bg-background-elevated/90 backdrop-blur-md border-b border-border shadow-sm",
            )}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Hamburger Button */}
              {!isMainDashboard && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-subtle hover:text-foreground transition-colors lg:hidden active:scale-95"
                >
                  <Menu size={20} />
                </button>
              )}

              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse shrink-0",
                    "bg-primary",
                  )}
                />
                <h1
                  className={cn(
                    "text-[12px] sm:text-[14px] font-bold uppercase tracking-widest transition-colors truncate",
                    "text-muted-foreground",
                  )}
                >
                  <span className="hidden sm:inline">
                    Vault Control Systems
                  </span>
                  <span className="sm:hidden">Vault OS</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div
                className={cn(
                  "text-[10px] sm:text-[11px] font-mono font-bold px-3 py-1 rounded-full border transition-all shrink-0",
                  "bg-subtle border-border text-muted-foreground",
                )}
              >
                ADMIN
              </div>
              {isMainDashboard && (
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Secure Disconnect"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </header>

          {/* Dynamic Padding and Scroll Area */}
          <div
            className={cn(
              "flex-1 overflow-y-auto custom-scrollbar transition-all duration-500",
              "bg-background",
              isMainDashboard
                ? "p-4 sm:p-8 md:p-12 lg:p-20"
                : "p-4 sm:p-6 lg:p-8",
            )}
          >
            <div
              className={cn(
                "mx-auto transition-all duration-700 h-full",
                isMainDashboard ? "max-w-5xl" : "max-w-7xl",
              )}
            >
              {children}
            </div>
          </div>
        </main>
        <PipelineHUD />
      </div>
    </UploadProvider>
  );
}