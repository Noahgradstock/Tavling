"use client";

import { Flag, PdfIcon, seg, type DocCard } from "@/lib/demo-shared";

// Search stage: the brain reaches every source that mentions the question, then the sources
// arrive as documents and get scanned. `q` runs 0 → 1; `cards` are the real sources for this question.

// Graph geometry in a 600x420 space: sources sit on an ellipse around the brain.
const GW = 600;
const GH = 420;
const R = 175;
const at = (angle: number, r: number) => ({
  x: GW / 2 + r * 1.23 * Math.cos((angle * Math.PI) / 180),
  y: GH / 2 + r * 0.77 * Math.sin((angle * Math.PI) / 180),
});
const angleOf = (i: number, n: number) => -90 + (i * 360) / n;
const STAGGER = 0.07;

export const timing = (q: number) => ({
  graphIn: seg(q, 0, 0.08),
  search: seg(q, 0.08, 0.45),
  graphOut: seg(q, 0.5, 0.58),
  docsIn: seg(q, 0.55, 0.72),
  scan: seg(q, 0.72, 1),
});

// Each source is reached by the search in turn.
const reach = (search: number, i: number) => seg(search, i * STAGGER, i * STAGGER + 0.5);
const scanOf = (scan: number, i: number) => seg(scan, i * STAGGER, i * STAGGER + 0.45);

export default function SearchStage({ cards, q, loading }: { cards: DocCard[]; q: number; loading: boolean }) {
  const { graphIn, search, graphOut, docsIn, scan } = timing(q);
  const found = cards.filter((_, i) => reach(search, i) >= 1).length;

  return (
    <div className="relative h-[380px]">
      {/* Scene 1: the company's knowledge, waiting to be searched */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl" style={{ opacity: 1 - graphIn, transform: `scale(${1 - 0.05 * graphIn})` }}>
        <div className="absolute inset-0 flex items-stretch justify-between px-2" aria-hidden>
          {Array.from({ length: 72 }, (_, i) => (
            <span
              key={i}
              className="barcode-bar"
              style={{
                width: 1 + ((i * 7) % 4),
                background: i % 11 === 3 ? "#1463ff" : "#161616",
                animationDelay: `${(i % 18) * (loading ? 0.04 : 0.11)}s`,
                animationDuration: loading ? "0.8s" : undefined,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-[#e3e2df] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
            {loading ? "Understanding the question…" : "Company knowledge · SharePoint · Teams · Email · Law"}
          </span>
        </div>
      </div>

      {cards.length > 0 && (
        <>
          {/* Scene 2: the company brain searches every connected source */}
          <div
            className="absolute inset-0"
            style={{
              opacity: graphIn * (1 - graphOut),
              transform: `scale(${0.94 + 0.06 * graphIn - 0.08 * graphOut})`,
              pointerEvents: "none",
            }}
          >
            <Graph cards={cards} search={search} />
            <div className="absolute inset-x-0 bottom-0 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {search < 1 ? `Searching company knowledge and law · ${found}/${cards.length}` : `${cards.length} sources found`}
            </div>
          </div>

          {/* Scene 3: the sources arrive as documents and get scanned */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-2.5" style={{ opacity: docsIn > 0 ? 1 : 0 }}>
            {cards.map((c, i) => (
              <Page key={c.id} card={c} i={i} n={cards.length} docsIn={docsIn} scan={scan} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// File chips shown in the prompt while documents are scanned.
export function ScanChips({ cards, q }: { cards: DocCard[]; q: number }) {
  const { docsIn, scan } = timing(q);
  if (docsIn <= 0) return null;
  return (
    <div className="mb-2 flex gap-1.5 overflow-hidden">
      {cards.map((c, i) => {
        const v = scanOf(scan, i);
        return (
          <div
            key={c.id}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-2 py-1 transition-opacity"
            style={{ opacity: seg(docsIn, i * STAGGER, i * STAGGER + 0.4) }}
          >
            <PdfIcon />
            <div className="leading-tight">
              <div className="max-w-[88px] truncate text-[9px] font-medium">{c.file}</div>
              <div className="text-[8px] text-neutral-400">{v <= 0 ? c.channel : v < 1 ? `Scanning ${Math.round(v * 100)}%` : "Scanned ✓"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Graph({ cards, search }: { cards: DocCard[]; search: number }) {
  const n = cards.length;
  return (
    <div className="relative mx-auto h-full w-full max-w-[600px]">
      <svg viewBox={`0 0 ${GW} ${GH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {cards.map((s, i) => {
          const p = at(angleOf(i, n), R);
          const r = reach(search, i);
          const c = { x: GW / 2, y: GH / 2 };
          return (
            <g key={s.id}>
              <line x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke="#cfcdc9" strokeWidth={1.5} />
              <line x1={c.x} y1={c.y} x2={c.x + (p.x - c.x) * r} y2={c.y + (p.y - c.y) * r} stroke="#1463ff" strokeOpacity={0.5} strokeWidth={1.5} />
              {r > 0 && r < 1 && <circle cx={c.x + (p.x - c.x) * r} cy={c.y + (p.y - c.y) * r} r={4} fill="#1463ff" />}
            </g>
          );
        })}
      </svg>
      {cards.map((s, i) => {
        const p = at(angleOf(i, n), R);
        return (
          <div
            key={s.id}
            className="absolute flex max-w-[190px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white py-1 pl-1.5 pr-3 text-[12px] font-medium shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ left: `${(p.x / GW) * 100}%`, top: `${(p.y / GH) * 100}%` }}
          >
            <Ring v={reach(search, i)} />
            {s.official && <Flag country={s.country} />}
            <span className="truncate">{s.short}</span>
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[22px] bg-[#161616] text-white shadow-xl">
        {search > 0 && search < 1 && <span className="absolute inset-0 animate-ping rounded-[22px] bg-[#1463ff]/20" />}
        <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="14" cy="14" r="6" />
          <circle cx="26" cy="14" r="6" />
          <circle cx="14" cy="26" r="6" />
          <circle cx="26" cy="26" r="6" />
        </svg>
      </div>
    </div>
  );
}

function Ring({ v }: { v: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 28 28" className="h-4 w-4 shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="#e3e3e3" strokeWidth="3.5" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="#1463ff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

function Page({ card: s, i, n, docsIn, scan }: { card: DocCard; i: number; n: number; docsIn: number; scan: number }) {
  const inV = seg(docsIn, i * STAGGER, i * STAGGER + 0.5);
  const v = scanOf(scan, i);
  const idx = s.highlight ? s.text.toLowerCase().indexOf(s.highlight.toLowerCase()) : -1;
  const before = idx >= 0 ? s.text.slice(0, idx) : s.text;
  const mark = idx >= 0 ? s.text.slice(idx, idx + s.highlight.length) : "";
  const after = idx >= 0 ? s.text.slice(idx + s.highlight.length) : "";
  // Pages fly in from the brain in the middle of the stage.
  const p = at(angleOf(i, n), R);
  const dx = (GW / 2 - p.x) * 0.5 * (1 - inV);
  const dy = (GH / 2 - p.y) * 0.5 * (1 - inV);

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
