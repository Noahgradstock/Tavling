"use client";

import type { ReactNode } from "react";
import { Flag, seg, type DocCard } from "@/lib/demo-shared";
import { DatabaseLogo, DocsLogo, GmailLogo, OutlookLogo, TeamsLogo } from "./logos";

// Connect stage: before reading anything, the brain searches every connected system. `q` runs 0 → 1.

const SOURCES: { name: string; logo: ReactNode; match: (c: DocCard) => boolean }[] = [
  { name: "Teams", logo: <TeamsLogo />, match: (c) => c.channel === "Teams" },
  { name: "Outlook", logo: <OutlookLogo />, match: (c) => c.channel === "Email" },
  { name: "Gmail", logo: <GmailLogo />, match: () => false },
  { name: "Database", logo: <DatabaseLogo />, match: () => false },
  { name: "SharePoint", logo: <DocsLogo />, match: (c) => c.channel === "SharePoint" },
  { name: "EU law", logo: <Flag country="EU" size={16} />, match: (c) => c.official && c.country === "EU" },
  { name: "BE law", logo: <Flag country="BE" size={16} />, match: (c) => c.official && c.country === "BE" },
];

const W = 700;
const TILE_Y = 60;
const BRAIN_Y = 300;
const xOf = (i: number) => 50 + i * ((W - 100) / (SOURCES.length - 1));
const reach = (q: number, i: number) => seg(q, 0.05 + i * 0.08, 0.4 + i * 0.08);

export const connectText = "Searching Teams, Outlook, Gmail, the database and the law";

export default function ConnectStage({ cards, q }: { cards: DocCard[]; q: number }) {
  return (
    <div className="relative h-[380px] w-full">
      <svg viewBox={`0 0 ${W} 380`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {SOURCES.map((s, i) => {
          const d = `M${xOf(i)} ${TILE_Y + 70} C${xOf(i)} ${TILE_Y + 170} ${W / 2} ${BRAIN_Y - 110} ${W / 2} ${BRAIN_Y - 30}`;
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke="#d6d3cd" strokeWidth="1.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              <path
                d={d}
                fill="none"
                stroke="#1463ff"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - reach(q, i)}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      {SOURCES.map((s, i) => {
        const r = reach(q, i);
        const n = cards.filter(s.match).length;
        return (
          <div
            key={s.name}
            className="absolute flex w-20 -translate-x-1/2 flex-col items-center gap-1 text-center"
            style={{ left: `${(xOf(i) / W) * 100}%`, top: TILE_Y - 40, opacity: 0.4 + 0.6 * Math.min(1, r * 3) }}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition [&>svg:not([aria-label])]:h-7 [&>svg:not([aria-label])]:w-7 ${
                r > 0 && r < 1 ? "ring-2 ring-[#1463ff]/40" : ""
              }`}
            >
              {s.logo}
            </div>
            <div className="text-[11px] font-medium">{s.name}</div>
            <div className={`text-[10px] ${r >= 1 && n ? "text-[#1463ff]" : "text-neutral-400"}`}>
              {r <= 0 ? "Connected" : r < 1 ? "Searching…" : n ? `${n} found` : "Nothing new"}
            </div>
          </div>
        );
      })}

      <div
        className="absolute left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#161616] text-white shadow-xl"
        style={{ top: `${(BRAIN_Y / 380) * 100}%` }}
      >
        {q > 0.05 && q < 1 && <span className="absolute inset-0 animate-ping rounded-2xl bg-[#1463ff]/20" />}
        <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="14" cy="14" r="6" />
          <circle cx="26" cy="14" r="6" />
          <circle cx="14" cy="26" r="6" />
          <circle cx="26" cy="26" r="6" />
        </svg>
      </div>
    </div>
  );
}
