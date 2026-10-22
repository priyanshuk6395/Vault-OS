"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.ok) {
        router.push("/admin");
      } else {
        setError("Unauthorized access. Check your credentials and try again.");
      }
    } catch (error) {
      console.error("[LOGIN_REQUEST_FAILED]:", error);
      setError("Unable to reach the authentication service. Check the server URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6"><ThemeToggle /></div>
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-subtle border border-border mb-4">
            <Lock className="text-primary" size={20} />
          </div>
          <h1 className="text-2xl font-serif text-foreground">Admin Vault</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-mono">
            Authorization Required
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            aria-label="Username"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-card border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all"
          />
          <input
            type="password"
            aria-label="Password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-card border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-all"
          />
          {error && <p role="alert" className="text-sm text-accent-coral">{error}</p>}
          <button disabled={loading} className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-60">
            {loading ? "Authenticating..." : "Enter Vault"}
          </button>
        </form>
      </div>
    </main>
  );
}
