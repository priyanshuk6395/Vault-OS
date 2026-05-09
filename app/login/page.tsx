"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (res?.ok) {
      router.push("/admin"); // Redirect to the Zoom Out View
    } else {
      setLoading(false);
      alert("Unauthorized Access: Vault Credentials Invalid");
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0d0f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 mb-4">
            <Lock className="text-[#c94a20]" size={20} />
          </div>
          <h1 className="text-2xl font-serif text-white">Admin Vault</h1>
          <p className="text-white/40 text-sm mt-1 uppercase tracking-widest font-mono">
            Authorization Required
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#c94a20] outline-none transition-all"
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#c94a20] outline-none transition-all"
          />
          <button className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all active:scale-[0.98]">
            Enter Vault
          </button>
        </form>
      </div>
    </main>
  );
}
