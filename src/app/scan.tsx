"use client";

import { Flag, seg, type DocCard } from "@/lib/demo-shared";

// Scan stage: the sources for this question arrive as documents and get scanned, before they are sorted.
// `q` runs 0 → 1.

const STAGGER = 0.07;
export const scanTiming = (q: number) => ({ docsIn: seg(q, 0, 0.4), scan: seg(q, 0.3, 1) });
const scanOf = (scan: number, i: number) => seg(scan, i * STAGGER, i * STAGGER + 0.45);

// How many documents are fully scanned at q.
export const scannedCount = (q: number, n: number) => Array.from({ length: n }, (_, i) => scanOf(scanTiming(q).scan, i)).filter((v) => v >= 1).length;

export default function ScanStage({ cards, q }: { cards: DocCard[]; q: number }) {
  const { docsIn, scan } = scanTiming(q);
  return (
    <div className="grid h-[380px] grid-cols-4 grid-rows-2 gap-3">
      {cards.map((c, i) => (
        <Page key={c.id} card={c} i={i} docsIn={docsIn} scan={scan} />
      ))}
    </div>
  );
}

function Page({ card: s, i, docsIn, scan }: { card: DocCard; i: number; docsIn: number; scan: number }) {
  const inV = seg(docsIn, i * STAGGER, i * STAGGER + 0.5);
  const v = scanOf(scan, i);
  const idx = s.highlight ? s.text.toLowerCase().indexOf(s.highlight.toLowerCase()) : -1;
  const before = idx >= 0 ? s.text.slice(0, idx) : s.text;
  const mark = idx >= 0 ? s.text.slice(idx, idx + s.highlight.length) : "";
  const after = idx >= 0 ? s.text.slice(idx + s.highlight.length) : "";
  const dx = 0;
  const dy = 24 * (1 - inV);

  return (
    <div
      className="relative overflow-hidden rounded-md bg-[#fdfdfb] p-2.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
      style={{
        opacity: inV,
        transform: `translate(${dx}px, ${dy}px) scale(${0.7 + 0.3 * inV}) rotate(${(1 - inV) * (i % 2 ? 4 : -4)}deg)`,
      }}
    >
      <div className="flex items-center justify-between border-b border-black/10 pb-1 font-mono text-[7px] uppercase tracking-widest text-neutral-400">
        <span className="truncate">{s.channel}</span>
        <span className="flex shrink-0 items-center gap-1">
          {s.official ? <Flag country={s.country} size={9} /> : `${s.country} ·`}
          {s.date.slice(0, 7)}
        </span>
      </div>
      <div className="mt-1.5 line-clamp-2 font-serif text-[12px] leading-tight">{s.title}</div>
      <p className="mt-1.5 line-clamp-4 text-[8px] leading-[1.45] text-neutral-500">
        {before}
        {mark && (
          <mark className="rounded-sm px-0.5 text-[#161616] transition-colors" style={{ background: v >= 1 ? "#cfe0ff" : "transparent" }}>
            {mark}
          </mark>
        )}
        {after}
      </p>
      <div className="absolute inset-x-2.5 bottom-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="-rotate-2 truncate font-signature text-[14px] leading-none text-[#1f3a8a]">{s.signer.name}</div>
          <div className="mt-0.5 truncate border-t border-black/15 pt-0.5 text-[6.5px] text-neutral-400">{s.signer.role}</div>
        </div>
      </div>
      {/* Scanner sweep */}
      {v > 0 && v < 1 && (
        <>
          <div className="absolute inset-x-0 top-0 bg-[#1463ff]/[0.06]" style={{ height: `${v * 100}%` }} />
          <div className="absolute inset-x-0 h-[2px] bg-[#1463ff] shadow-[0_0_12px_2px_rgba(20,99,255,0.5)]" style={{ top: `${v * 100}%` }} />
        </>
      )}
    </div>
  );
}
