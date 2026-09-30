"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskResult, Claim, Person } from "@/trust-engine";

export type Hit = Extract<AskResult, { matched: true }>;

export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const pct = (n: number) => Math.round(n * 100);
export const color = (s: number) => (s >= 0.75 ? "#1463ff" : s >= 0.5 ? "#e39a0b" : "#e5484d");

export const CHANNEL = { official: "Official", teams: "Teams", sharepoint: "SharePoint", email: "Email" } as const;
const EXT = { official: "pdf", teams: "json", sharepoint: "docx", email: "eml" } as const;

// How one engine claim looks as a document card in the visualization.
export type DocCard = {
  id: string;
  short: string;
  title: string;
  channel: string;
  file: string;
  country: string;
  date: string;
  text: string;
  highlight: string;
  official: boolean;
  signer: { name: string; role: string };
};

export function toCard(c: Claim, people: Record<string, Person>): DocCard {
  const p = c.author ? people[c.author] : undefined;
  const first = p?.name.split(" ")[0];
  const role = !p
    ? "Official"
    : p.left
      ? "Left the company"
      : p.role === "expert"
        ? `Expert · ${p.team}`
        : p.role === "new"
          ? "New hire"
          : p.team;
  return {
    id: c.id,
    short: c.source.type === "teams" ? `Teams · ${first}` : c.source.title,
    title: c.source.title,
    channel: CHANNEL[c.source.type],
    file: `${c.source.title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 26)}.${EXT[c.source.type]}`,
    country: c.scope.country,
    date: c.effectiveFrom ?? c.date,
    text: c.text,
    // The scanner highlights the value where it appears in the text.
    highlight: c.text.toLowerCase().includes(c.value.toLowerCase()) ? c.value : "",
    official: c.source.type === "official",
    signer: { name: p?.name ?? "Official publication", role },
  };
}

// Relevant claims first (best score first), then the ones that don't apply. Max 8 fit the stage.
export function cardsOf(hit: Hit): DocCard[] {
  return [...hit.claims.map((c) => c.claim), ...hit.excluded.map((e) => e.claim)].slice(0, 8).map((c) => toCard(c, hit.people));
}

export const shortReason = (reason: string) =>
  reason.startsWith("Applies to PC")
    ? "Other sector"
    : reason.startsWith("Applies to")
      ? "Other country"
      : reason.startsWith("Specific")
        ? "Other client"
        : "Reported not applicable";

// Drives an animation from 0 to 1 over `duration` ms each time `run` changes. skip() jumps to the end.
export function useTimeline(run: number, duration: number) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    const t0 = performance.now();
    const tick = (t: number) => {
      const v = clamp((t - t0) / duration);
      setP(v);
      if (v < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [run, duration]);
  const skip = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setP(1);
  }, []);
  return [p, skip] as const;
}

export function PdfIcon() {
  return (
    <svg viewBox="0 0 16 20" className="h-4 w-3.5 shrink-0">
      <path d="M2 0h8l6 6v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="#e5484d" />
      <path d="M10 0v4a2 2 0 0 0 2 2h4" fill="#ff9a9d" />
      <text x="8" y="15.5" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#fff">
        DOC
      </text>
    </svg>
  );
}

export function Flag({ country, size = 12 }: { country: string; size?: number }) {
  const w = Math.round(size * 1.4);
  return (
    <svg viewBox="0 0 21 15" width={w} height={size} className="shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-label={country}>
      {country === "BE" && (
        <>
          <rect width="7" height="15" fill="#1a1a1a" />
          <rect x="7" width="7" height="15" fill="#fdda24" />
          <rect x="14" width="7" height="15" fill="#ef3340" />
        </>
      )}
      {country === "NL" && (
        <>
          <rect width="21" height="5" fill="#ae1c28" />
          <rect y="5" width="21" height="5" fill="#fff" />
          <rect y="10" width="21" height="5" fill="#21468b" />
        </>
      )}
      {country === "EU" && (
        <>
          <rect width="21" height="15" fill="#003399" />
          {Array.from({ length: 12 }, (_, k) => (
            <circle
              key={k}
              cx={(10.5 + 4.6 * Math.cos((k * Math.PI) / 6)).toFixed(2)}
              cy={(7.5 + 4.6 * Math.sin((k * Math.PI) / 6)).toFixed(2)}
              r="0.75"
              fill="#ffcc00"
            />
          ))}
        </>
      )}
    </svg>
  );
}
