"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function DashboardGreeting({ userName }: { userName: string }) {
  useEffect(() => {
    // Session storage prevents the toast from firing on every page navigation
    const hasGreeted = sessionStorage.getItem("vault_greeted");
    
    if (!hasGreeted) {
      const timer = setTimeout(() => {
        toast("Authentication Successful", {
          description: `Welcome to the Command Center, ${userName}.`,
          icon: <ShieldCheck className="text-green-500" size={16} />,
        });
        sessionStorage.setItem("vault_greeted", "true");
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [userName]);

  return null; // This component is invisible
}