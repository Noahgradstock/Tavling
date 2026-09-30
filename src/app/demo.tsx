"use client";

import { useEffect, useRef, useState } from "react";
import { customer, sources, type Source } from "@/lib/knowledge";

// Scroll drives the whole demo: 0 → 1 across a tall section while the stage stays pinned.
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

// How each source looks as a document, and the sentence the scanner picks out.
const DOCS: Record<string, { file: string; highlight: string }> = {
  "policy-2026": { file: "BE_Sick_Leave_Policy_2026.pdf", highlight: "extended from 14 days to 8 weeks" },
  "manual-2023": { file: "Payroll_Manual_BE_v4.pdf", highlight: "more than 14 days after returning to work" },
  "nl-guide": { file: "Ziekteverzuim_NL.pdf", highlight: "within 4 weeks are added together" },
  "teams-tom": { file: "Teams_payroll-be_export.pdf", highlight: "relapse is still 14 days" },
  "faq-solidarity": { file: "Newsletter_Solidarity_2026.pdf", highlight: "at least 50 employees" },
  "draft-email": { file: "Legal_Relapse_DRAFT.pdf", highlight: "DRAFT – not voted yet" },
};

const CONNECTORS = ["SharePoint", "Confluence", "Teams", "Outlook"];

// Graph geometry in a 600x420 space.
const GW = 600;
const GH = 420;
const ANGLES = [-90, -30, 30, 90, 150, 210];
const at = (angle: number, r: number) => ({
  x: GW / 2 + r * Math.cos((angle * Math.PI) / 180),
  y: GH / 2 + r * Math.sin((angle * Math.PI) / 180) * 0.72,
});

function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / (r.height - window.innerHeight)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return [ref, p] as const;
}

export default function Demo() {
  const [ref, p] = useScrollProgress<HTMLDivElement>();

  const typed = seg(p, 0.03, 0.22);
  const sent = p > 0.24;
  const graphIn = seg(p, 0.25, 0.31);
  const search = seg(p, 0.31, 0.56);
  const graphOut = seg(p, 0.58, 0.64);
  const docsIn = seg(p, 0.6, 0.74);
  const scan = seg(p, 0.74, 0.97);

  const step = p < 0.25 ? 0 : p < 0.6 ? 1 : 2;
  const found = sources.filter((_, i) => reach(search, i) >= 1).length;

  return (
    <div ref={ref} className="relative h-[520vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-2xl flex-col gap-3">
          <Steps step={step} />

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#e9e8e6] to-[#dddcd9] p-4 sm:p-6">
            <Prompt typed={typed} sent={sent} docsIn={docsIn} scan={scan} />

            <div className="relative mt-4 h-[380px]">
              {/* Scene 1: the company's knowledge, waiting to be searched */}
              <div
                className="absolute inset-0 overflow-hidden rounded-2xl"
                style={{ opacity: 1 - graphIn, transform: `scale(${1 - 0.05 * graphIn})` }}
              >
                <div className="absolute inset-0 flex items-stretch justify-between px-2" aria-hidden>
                  {Array.from({ length: 72 }, (_, i) => (
                    <span
                      key={i}
                      className="barcode-bar"
                      style={{
                        width: 1 + ((i * 7) % 4),
                        background: i % 11 === 3 ? "#1463ff" : "#161616",
                        animationDelay: `${(i % 18) * 0.11}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="rounded-full bg-[#e3e2df] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                    12,480 documents · 4 connected sources
                  </span>
                </div>
              </div>

              {/* Scene 2: the company brain searches every connected source */}
              <div
                className="absolute inset-0"
                style={{
                  opacity: graphIn * (1 - graphOut),
                  transform: `scale(${0.94 + 0.06 * graphIn - 0.08 * graphOut})`,
                  pointerEvents: "none",
                }}
              >
                <Graph search={search} />
                <div className="absolute inset-x-0 bottom-0 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  {search < 1 ? `Searching company knowledge · ${found}/6` : "6 sources found"}
                </div>
              </div>

              {/* Scene 3: the sources arrive as documents and get scanned */}
              <div className="absolute inset-0 grid grid-cols-3 gap-3" style={{ opacity: docsIn > 0 ? 1 : 0 }}>
                {sources.map((s, i) => (
                  <Page key={s.id} source={s} i={i} docsIn={docsIn} scan={scan} />
                ))}
              </div>
            </div>
          </div>
          <div className="text-center text-[11px] text-neutral-400">{p < 0.02 ? "Scroll to run the demo ↓" : " "}</div>
        </div>
      </div>
    </div>
  );
}

// Each source is reached by the search in turn.
const reach = (search: number, i: number) => seg(search, i * 0.1, i * 0.1 + 0.5);
const scanOf = (scan: number, i: number) => seg(scan, i * 0.1, i * 0.1 + 0.45);

function Steps({ step }: { step: number }) {
  const labels = ["Ask", "Search", "Documents"];
  return (
    <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em]">
      {labels.map((l, i) => (
        <span key={l} className={`flex items-center gap-1.5 transition-colors ${i === step ? "text-[#161616]" : "text-neutral-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${i <= step ? "bg-[#1463ff]" : "bg-neutral-300"}`} />
          0{i + 1} {l}
        </span>
      ))}
    </div>
  );
}

function Prompt({ typed, sent, docsIn, scan }: { typed: number; sent: boolean; docsIn: number; scan: number }) {
  const text = customer.question.slice(0, Math.round(customer.question.length * typed));
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]">
      {docsIn > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-hidden">
          {sources.map((s, i) => {
            const v = scanOf(scan, i);
            return (
              <div
                key={s.id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-100 px-2 py-1 transition-opacity"
                style={{ opacity: seg(docsIn, i * 0.1, i * 0.1 + 0.4) }}
              >
                <PdfIcon />
                <div className="leading-tight">
                  <div className="max-w-[88px] truncate text-[9px] font-medium">{DOCS[s.id].file}</div>
                  <div className="text-[8px] text-neutral-400">
                    {v <= 0 ? "PDF" : v < 1 ? `Scanning ${Math.round(v * 100)}%` : "Scanned ✓"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mb-1 flex items-center gap-2 text-[10px] text-neutral-400">
        <span className="rounded-full bg-[#fff4dc] px-1.5 py-0.5 font-medium text-[#9a6400]">Customer question</span>
        {customer.contact} · {customer.company}
      </div>
      <p className="min-h-[3.75rem] text-[13px] leading-relaxed">
        {text}
        {typed < 1 && <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-[#1463ff]" />}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {CONNECTORS.map((c) => (
          <span key={c} className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500">
            {c}
          </span>
        ))}
        <span
          className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full text-xs text-white transition-colors ${
            sent ? "bg-[#161616]" : "bg-neutral-300"
          }`}
        >
          ↑
        </span>
      </div>
    </div>
  );
}

function Graph({ search }: { search: number }) {
  return (
    <div className="relative mx-auto h-full w-full max-w-[600px]">
      <svg viewBox={`0 0 ${GW} ${GH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {sources.map((s, i) => {
          const n = at(ANGLES[i], 175);
          const r = reach(search, i);
          const c = { x: GW / 2, y: GH / 2 };
          return (
            <g key={s.id}>
              <line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke="#cfcdc9" strokeWidth={1.5} />
              <line
                x1={c.x}
                y1={c.y}
                x2={c.x + (n.x - c.x) * r}
                y2={c.y + (n.y - c.y) * r}
                stroke="#1463ff"
                strokeOpacity={0.5}
                strokeWidth={1.5}
              />
              {r > 0 && r < 1 && (
                <circle cx={c.x + (n.x - c.x) * r} cy={c.y + (n.y - c.y) * r} r={4} fill="#1463ff" />
              )}
            </g>
          );
        })}
      </svg>
      {sources.map((s, i) => {
        const n = at(ANGLES[i], 175);
        const r = reach(search, i);
        return (
          <div
            key={s.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white py-1 pl-1.5 pr-3 text-[12px] font-medium shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
            style={{ left: `${(n.x / GW) * 100}%`, top: `${(n.y / GH) * 100}%` }}
          >
            <Ring v={r} />
            {s.short}
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
    <svg viewBox="0 0 28 28" className="h-4 w-4">
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

function Page({ source: s, i, docsIn, scan }: { source: Source; i: number; docsIn: number; scan: number }) {
  const inV = seg(docsIn, i * 0.1, i * 0.1 + 0.5);
  const v = scanOf(scan, i);
  const { highlight } = DOCS[s.id];
  const [before, after] = s.text.split(highlight);
  // Pages fly in from the brain in the middle of the stage.
  const n = at(ANGLES[i], 175);
  const dx = (GW / 2 - n.x) * 0.5 * (1 - inV);
  const dy = (GH / 2 - n.y) * 0.5 * (1 - inV);

  return (
    <div
      className="relative overflow-hidden rounded-md bg-[#fdfdfb] p-2.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
      style={{
        opacity: inV,
        transform: `translate(${dx}px, ${dy}px) scale(${0.7 + 0.3 * inV}) rotate(${(1 - inV) * (i % 2 ? 4 : -4)}deg)`,
      }}
    >
      <div className="flex items-center justify-between border-b border-black/10 pb-1 font-mono text-[7px] uppercase tracking-widest text-neutral-400">
        <span>{s.channel}</span>
        <span>
          {s.country} · {s.date.slice(0, 7)}
        </span>
      </div>
      <div className="mt-1.5 font-serif text-[12px] leading-tight">{s.title}</div>
      <p className="mt-1.5 line-clamp-[8] text-[7.5px] leading-[1.45] text-neutral-500">
        {before}
        <mark
          className="rounded-sm px-0.5 text-[#161616] transition-colors"
          style={{ background: v >= 1 ? "#cfe0ff" : "transparent" }}
        >
          {highlight}
        </mark>
        {after}
      </p>
      <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between text-[7px] text-neutral-400">
        <span>{s.owner ?? "No owner"}</span>
        <span>{s.status === "draft" ? "DRAFT" : "p. 1"}</span>
      </div>
      {/* Scanner sweep */}
      {v > 0 && v < 1 && (
        <>
          <div className="absolute inset-x-0 top-0 bg-[#1463ff]/[0.06]" style={{ height: `${v * 100}%` }} />
          <div
            className="absolute inset-x-0 h-[2px] bg-[#1463ff] shadow-[0_0_12px_2px_rgba(20,99,255,0.5)]"
            style={{ top: `${v * 100}%` }}
          />
        </>
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 16 20" className="h-4 w-3.5 shrink-0">
      <path d="M2 0h8l6 6v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="#e5484d" />
      <path d="M10 0v4a2 2 0 0 0 2 2h4" fill="#ff9a9d" />
      <text x="8" y="15.5" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#fff">
        PDF
      </text>
    </svg>
  );
}
