"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import SideBar from "@/components/admin/SideBar";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { UploadProvider } from "@/context/UploadProvider";
import PipelineHUD from "@/components/admin/PipelineHUD";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fullScreenRoutes = ["/admin", "/admin/new-event", "/admin/new"];
  const isMainDashboard = fullScreenRoutes.includes(pathname);

  // Close the mobile menu automatically when the user navigates to a new page
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <UploadProvider>
      <div
        className={cn(
          "flex h-[100dvh] font-sans transition-colors duration-500 overflow-hidden relative",
          isMainDashboard ? "bg-[#0d0d0f]" : "bg-[#f5f4f0]",
        )}
      >
        {/* 1. MOBILE SIDEBAR BACKDROP */}
        {!isMainDashboard && (
          <div
            className={cn(
              "fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] lg:hidden transition-all duration-300",
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
              "fixed inset-y-0 left-0 z-[50] w-[224px] shrink-0 transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none",
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SideBar />

            {/* Mobile Close Button - Hides seamlessly when menu is closed */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "absolute top-4 -right-12 p-2 bg-[#0e0e0f] text-white rounded-r-xl lg:hidden shadow-lg border border-l-0 border-white/10 transition-opacity duration-300",
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
              "h-[60px] sm:h-[70px] shrink-0 flex items-center justify-between px-4 sm:px-8 z-10 transition-all duration-500",
              isMainDashboard
                ? "bg-[#0d0d0f]/80 backdrop-blur-md border-b border-white/5 shadow-none"
                : "bg-white border-b border-[#dbd8cf] shadow-sm",
            )}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Hamburger Button */}
              {!isMainDashboard && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-2 rounded-lg text-[#5a5a64] hover:bg-[#f5f4f0] hover:text-[#0e0e0f] transition-colors lg:hidden active:scale-95"
                >
                  <Menu size={20} />
                </button>
              )}

              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse shrink-0",
                    isMainDashboard ? "bg-[#c94a20]" : "bg-[#c94a20]",
                  )}
                />
                <h1
                  className={cn(
                    "text-[12px] sm:text-[14px] font-bold uppercase tracking-widest transition-colors truncate",
                    isMainDashboard ? "text-white/40" : "text-[#5a5a64]",
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
              <div
                className={cn(
                  "text-[10px] sm:text-[11px] font-mono font-bold px-3 py-1 rounded-full border transition-all shrink-0",
                  isMainDashboard
                    ? "bg-white/5 border-white/10 text-white/60"
                    : "bg-[#f5f4f0] border-[#dbd8cf] text-[#0e0e0f]",
                )}
              >
                ADMIN
              </div>
              {isMainDashboard && (
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
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
              isMainDashboard ? "bg-[#0d0d0f]" : "bg-[#fbfaf8]",
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
