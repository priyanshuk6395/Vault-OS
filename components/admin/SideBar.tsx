"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard,
  Image as ImageIcon,
  UploadCloud,
  Users,
  ScanFace,
  ShieldCheck,
  Settings,
  History,
  LogOut,
  Home,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EventSwitcher from "./EventSwitcher";
import { signOut } from "next-auth/react";

interface SideBarProps {
  // Optional: only the mobile slide-out wrapper in layout.tsx passes this,
  // so nav links can close the menu on tap. Desktop renders SideBar with no props.
  onClose?: () => void;
}

export default function SideBar({ onClose }: SideBarProps) {
  const pathname = usePathname();
  const params = useParams();
  const eventId = params.eventId as string;

  const [stats, setStats] = useState({
    totalAssets: 0,
    totalPeople: 0,
    faceReviewCount: 0,
    guestUploadsCount: 0,
  });

  useEffect(() => {
    if (!eventId) return;

    async function fetchStats() {
      const res = await fetch(`/api/admin/sidebar-stats?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    }
    fetchStats();
  }, [eventId]);

  interface NavItem {
    label: string;
    href?: string;
    icon?: LucideIcon; // <--- This is the key
    badge?: number;
    isLabel?: boolean;
  }

  const navItems: NavItem[] = [
    { label: "Content", isLabel: true },
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: `/admin/${eventId}/overview`,
    },
    {
      label: "Media Library",
      icon: ImageIcon,
      href: `/admin/${eventId}/media`,
    },
    {
      label: "Guest Uploads",
      icon: UploadCloud,
      href: `/admin/${eventId}/guest-uploads`,
      badge: stats.guestUploadsCount,
    },
    { label: "Identity", isLabel: true },
    { label: "People", icon: Users, href: `/admin/${eventId}/people` },
    {
      label: "Face Review",
      icon: ScanFace,
      href: `/admin/${eventId}/face-review`,
      badge: stats.faceReviewCount,
    },
    { label: "Security", isLabel: true },
    {
      label: "Access Control",
      icon: ShieldCheck,
      href: `/admin/${eventId}/access`,
    },
    { label: "Audit Logs", icon: History, href: `/admin/${eventId}/audit` },
    { label: "System", isLabel: true },
    { label: "Settings", icon: Settings, href: `/admin/${eventId}/settings` },
  ];

  return (
    <aside className="w-56 min-w-56 bg-card h-screen flex flex-col border-r border-border relative z-10 text-muted-foreground">
      <div className="p-5 border-b border-border">
        <div className="font-serif text-[21px] text-foreground tracking-tight">
          Vault
        </div>
        <div className="text-[9.5px] text-muted-foreground tracking-[0.15em] uppercase font-mono mt-0.5">
          Event Media OS
        </div>
      </div>

      <EventSwitcher />

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item, idx) => {
          // 1. Extract and Capitalize the icon component
          const Icon = item.icon;

          return item.isLabel ? (
            <div
              key={idx}
              className="text-[9px] font-mono tracking-[0.14em] uppercase text-muted-foreground px-[18px] pt-[10px] pb-[3px]"
            >
              {item.label}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onClose}
              className={cn(
                "flex items-center gap-[9px] px-[18px] py-[8px] text-[12.5px] transition-all border-l-2 border-transparent hover:bg-subtle hover:text-foreground",
                pathname === item.href &&
                  "bg-subtle text-foreground border-primary",
              )}
            >
              {/* 2. Render using the capitalized alias */}
              {Icon && (
                <Icon
                  className={cn(
                    "w-4 h-4 opacity-70",
                    pathname === item.href && "text-primary opacity-100",
                  )}
                />
              )}
              <span>{item.label}</span>
              {(item.badge ?? 0) > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-[9px] font-mono px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-1 bg-subtle shrink-0">
        <Link
          href="/admin"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-all group"
        >
          <div className="p-1.5 rounded-md bg-background group-hover:bg-card transition-colors">
            <Home
              size={14}
              className="group-hover:scale-110 transition-transform"
            />
          </div>
          Return to Hub
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all group"
        >
          <div className="p-1.5 rounded-md bg-background group-hover:bg-red-500/20 transition-colors text-red-500/60 group-hover:text-red-500">
            <LogOut
              size={14}
              className="group-hover:scale-110 transition-transform"
            />
          </div>
          Secure Disconnect
        </button>
      </div>
    </aside>
  );
}