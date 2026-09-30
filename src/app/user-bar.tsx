"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; role: string; team: string };

// Who is signed in; feedback is recorded under this user.
export default function UserBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Full page load so no cached signed-in page stays reachable after logout.
    window.location.replace("/login");
  }

  if (!user) return null;
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-3 px-4 pt-4 text-xs text-neutral-500">
      <span>
        Signed in as <span className="font-medium text-neutral-800">{user.name}</span> · {user.role} · {user.team}
      </span>
      <button onClick={signOut} className="rounded-full border border-black/10 px-2.5 py-1 hover:border-black/30">
        Sign out
      </button>
    </div>
  );
}
