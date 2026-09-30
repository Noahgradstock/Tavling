"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Ask" },
  { href: "/brain", label: "Brain map" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav aria-label="Main" className="fixed left-4 top-4 z-50 flex gap-0.5 rounded-full bg-white/80 p-1 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur">
      {TABS.map((t) => {
        const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 transition ${on ? "bg-[#161616] text-white" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
