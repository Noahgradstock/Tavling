"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) return router.replace("/");
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e9e8e6] to-[#dddcd9] px-4 text-[#161616]">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Company brain</div>
        <h1 className="font-serif text-3xl leading-tight tracking-tight">Sign in</h1>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#161616] outline-none focus:border-[#1463ff]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-[#161616] outline-none focus:border-[#1463ff]"
          />
        </label>
        {error && <p className="rounded-lg bg-[#ffe9ea] px-3 py-2 text-xs text-[#c62a30]">{error}</p>}
        <button
          disabled={busy}
          className="mt-1 rounded-full bg-[#161616] px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
