"use client";

import { Flag, PdfIcon, SIGNERS, isLaw, seg, sources, useScrollProgress, type DemoSource } from "@/lib/demo-shared";
import { MOCK_NOW, STATUS, evaluateFact, mockKnowledgeBase, type ScoredClaim } from "@/trust-engine";

// The trust engine scores the relapse question for Brouwerij De Kroon. Deterministic, so it runs the same on server and client.
const fact = mockKnowledgeBase.facts.find((f) => f.key === "sick-relapse")!;
const result = evaluateFact(fact, mockKnowledgeBase, { country: "BE", pc: "200", client: "brouwerij-de-kroon" }, [], MOCK_NOW);

// Which engine claim each document carries.
const CLAIM_OF: Record<string, string> = {
  "be-law-1978": "off-relapse-2026",
  "policy-2026": "tm-relapse-an",
  "manual-2023": "sp-manual-relapse",
  "teams-tom": "tm-relapse-tom",
  "draft-email": "em-relapse-draft",
};
const scored = (id: string): ScoredClaim | undefined => result.claims.find((c) => c.claim.id === CLAIM_OF[id]);

// Gate 1: documents that don't apply to this case at all.
const NOT_RELEVANT: Record<string, string> = {
  "nl-guide": result.excluded.find((e) => e.claim.id === "sp-nl-relapse")?.reason ?? "Other country",
  "eu-883": "Only says which law applies",
  "faq-solidarity": "Other question: solidarity",
};

const LAYERS = [
  { key: "authority", name: "Authority", q: "Who said it?" },
  { key: "freshness", name: "Freshness", q: "When?" },
  { key: "corroboration", name: "Corroboration", q: "Who agrees?" },
  { key: "consistency", name: "Consistency", q: "Matches the law?" },
  { key: "relevance", name: "Relevance", q: "Fits this client?" },
  { key: "feedback", name: "Feedback", q: "Did it work?" },
];

const bestId = Object.keys(CLAIM_OF).find((id) => CLAIM_OF[id] === result.best?.claim.id)!;
const trustedIds = Object.keys(CLAIM_OF).filter((id) => (scored(id)?.score ?? 0) >= STATUS.trusted);

// Columns as % of the stage width, and the vertical band cards sit in.
const COLS = [
  { x: 0, w: 17, h: 32, label: "Found" },
  { x: 20, w: 41, h: 60, label: "Applies to this case" },
  { x: 64, w: 17, h: 54, label: "Trusted ≥ 75%" },
  { x: 84, w: 16, h: 150, label: "Read this first" },
];
const BAND_MID = 205;
const DROP_TOP = 372;
const GAP = 5;
const DROP_H = 30;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const color = (s: number) => (s >= STATUS.trusted ? "#1463ff" : s >= STATUS.usable ? "#e39a0b" : "#e5484d");

type Place = { col: number; mode: "found" | "scoring" | "trusted" | "best" | "dropped"; reason?: string };

function placeOf(id: string, stage: number): Place {
  if (stage === 0) return { col: 0, mode: "found" };
  if (NOT_RELEVANT[id]) return { col: 0, mode: "dropped", reason: NOT_RELEVANT[id] };
  if (stage === 1) return { col: 1, mode: "scoring" };
  if (!trustedIds.includes(id)) return { col: 1, mode: "dropped", reason: `${Math.round((scored(id)?.score ?? 0) * 100)}% · ${keyReason(id)}` };
  if (stage === 3 && id === bestId) return { col: 3, mode: "best" };
  return { col: 2, mode: "trusted" };
}

// The evidence line that pulls a score down the most.
function keyReason(id: string) {
  const ev = scored(id)?.evidence ?? [];
  return [...ev].sort((a, b) => a.points - b.points)[0]?.tag ?? "";
}

export default function Funnel() {
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const appear = seg(p, 0, 0.08);
  const stage = p < 0.14 ? 0 : p < 0.64 ? 1 : p < 0.78 ? 2 : 3;
  const layers = stage === 1 ? Math.min(6, Math.floor(seg(p, 0.18, 0.58) * 6.999)) : stage > 1 ? 6 : 0;

  // Where every card sits in this stage.
  const places = Object.fromEntries(sources.map((s) => [s.id, placeOf(s.id, stage)]));
  const layout = (id: string) => {
    const pl = places[id];
    const col = COLS[pl.col];
    const same = sources.filter((s) => places[s.id].col === pl.col && (places[s.id].mode === "dropped") === (pl.mode === "dropped"));
    const k = same.findIndex((s) => s.id === id);
    if (pl.mode === "dropped") return { left: col.x, width: col.w, top: DROP_TOP + k * (DROP_H + 4), height: DROP_H };
    const total = same.length * col.h + (same.length - 1) * GAP;
    return { left: col.x, width: col.w, top: BAND_MID - total / 2 + k * (col.h + GAP), height: col.h };
  };
  const counts = [sources.length, sources.length - Object.keys(NOT_RELEVANT).length, trustedIds.length, 1];
  const activeCol = stage === 0 ? 0 : stage === 1 ? 1 : stage === 2 ? 2 : 3;

  return (
    <div ref={ref} className="relative h-[460vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-4xl flex-col gap-3">
          <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em]">
            {["Criteria", "Score", "Decide"].map((l, i) => (
              <span key={l} className={`flex items-center gap-1.5 ${Math.min(stage, 2) === i ? "text-[#161616]" : "text-neutral-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${Math.min(stage, 2) >= i ? "bg-[#1463ff]" : "bg-neutral-300"}`} />
                0{i + 4} {l}
              </span>
            ))}
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-[#e9e8e6] to-[#dddcd9] p-4 sm:p-5">
            {/* The six criteria from the trust engine, lit as each one is applied */}
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {LAYERS.map((l, i) => {
                const on = layers > i;
                const current = stage === 1 && layers - 1 === i;
                return (
                  <div
                    key={l.key}
                    className={`rounded-xl px-2.5 py-2 transition-all duration-300 ${
                      on ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : "bg-white/40"
                    } ${current ? "ring-2 ring-[#1463ff]" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#1463ff]" : "bg-neutral-300"}`} />
                      Layer {i + 1}
                    </div>
                    <div className={`mt-0.5 text-[12px] font-medium ${on ? "text-[#161616]" : "text-neutral-400"}`}>{l.name}</div>
                    <div className="text-[10px] text-neutral-500">{l.q}</div>
                  </div>
                );
              })}
            </div>

            {/* The funnel: documents move left to right and get fewer */}
            <div className="relative mt-4 h-[480px]" style={{ opacity: appear }}>
              <svg viewBox="0 0 100 460" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <polygon
                  points="0,44 18.5,44 62.5,80 82.5,120 100,120 100,290 82.5,290 62.5,330 18.5,362 0,362"
                  fill="#fff"
                  fillOpacity="0.35"
                />
                {[18.5, 62.5, 82.5].map((x) => (
                  <line key={x} x1={x} x2={x} y1={30} y2={362} stroke="#b9b6b0" strokeWidth="0.15" strokeDasharray="1 1.5" />
                ))}
                <line x1="0" x2="100" y1="364" y2="364" stroke="#cfccc6" strokeWidth="0.1" />
              </svg>

              {COLS.map((c, i) => (
                <div
                  key={c.label}
                  className={`absolute top-0 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                    i === activeCol ? "text-[#161616]" : "text-neutral-400"
                  }`}
                  style={{ left: `${c.x}%`, width: `${c.w}%` }}
                >
                  {c.label} <span className="text-[#1463ff]">· {counts[i]}</span>
                </div>
              ))}
              {stage > 0 && (
                <div className="absolute font-mono text-[9px] uppercase tracking-widest text-neutral-400" style={{ top: DROP_TOP - 18, left: 0 }}>
                  Set aside
                </div>
              )}

              {sources.map((s) => (
                <Card key={s.id} source={s} place={places[s.id]} box={layout(s.id)} layers={layers} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  source: s,
  place,
  box,
  layers,
}: {
  source: DemoSource;
  place: Place;
  box: { left: number; width: number; top: number; height: number };
  layers: number;
}) {
  const sc = scored(s.id);
  const signer = SIGNERS[s.id];
  const shownLayers = LAYERS.slice(0, layers).map((l) => l.key);
  const evidence = sc?.evidence.filter((e) => shownLayers.includes(e.layer)) ?? [];
  // Score builds up layer by layer; after the last layer the engine's capped score is final.
  const score = !sc || layers === 0 ? null : layers >= 6 ? sc.score : sigmoid(evidence.reduce((sum, e) => sum + e.points, 0));
  const icon = isLaw(s) ? <Flag country={s.country} size={10} /> : <PdfIcon />;

  return (
    <div
      className={`absolute overflow-hidden rounded-xl transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
        place.mode === "dropped"
          ? "bg-white/50"
          : place.mode === "best"
            ? "bg-white shadow-[0_12px_40px_-12px_rgba(20,99,255,0.45)] ring-2 ring-[#1463ff]"
            : "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      }`}
      style={{ left: `${box.left}%`, width: `${box.width}%`, top: box.top, height: box.height }}
    >
      {place.mode === "dropped" ? (
        <div className="flex h-full flex-col justify-center px-2 leading-tight">
          <span className="truncate text-[10px] text-neutral-400 line-through">{s.short}</span>
          <span className="truncate text-[9px] text-[#c62a30]">{place.reason}</span>
        </div>
      ) : place.mode === "best" ? (
        <div className="flex h-full flex-col p-2.5">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#1463ff]">Open this</div>
          <div className="mt-1 flex items-center gap-1.5">
            {icon}
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">{s.short}</span>
          </div>
          <div className="mt-1 font-serif text-3xl leading-none" style={{ color: color(sc!.score) }}>
            {Math.round(sc!.score * 100)}%
          </div>
          <div className="mt-1 text-[9px] leading-snug text-neutral-500">
            Says <b className="text-[#161616]">{sc!.claim.value}</b> · official, in force since {sc!.claim.effectiveFrom}
          </div>
          <div className="mt-auto -rotate-2 truncate font-signature text-[15px] leading-none text-[#1f3a8a]">{signer.name}</div>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-1 px-2.5">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="truncate text-[11px] font-medium">{s.short}</span>
            {place.mode === "scoring" && (
              <span className="ml-1 hidden truncate font-signature text-[13px] leading-none text-[#1f3a8a] sm:inline">{signer.name}</span>
            )}
            {place.mode !== "found" && score !== null && (
              <span className="ml-auto shrink-0 font-serif text-lg leading-none tabular-nums" style={{ color: color(score) }}>
                {Math.round(score * 100)}
              </span>
            )}
          </div>
          {place.mode === "found" ? (
            <div className="truncate text-[9px] text-neutral-400">
              {signer.name} · {s.date.slice(0, 7)}
            </div>
          ) : place.mode === "scoring" ? (
            <div className="flex max-h-[34px] flex-wrap gap-1 overflow-hidden">
              {evidence.length === 0 && <span className="text-[9px] text-neutral-400">{signer.role} · {s.date.slice(0, 7)}</span>}
              {evidence.map((e, i) => (
                <span
                  key={i}
                  className={`shrink-0 rounded-full px-1.5 py-px text-[9px] ${
                    e.points >= 0 ? "bg-[#e8efff] text-[#1463ff]" : "bg-[#ffe9ea] text-[#c62a30]"
                  }`}
                >
                  {e.points > 0 ? "+" : ""}
                  {e.points} {e.tag}
                </span>
              ))}
            </div>
          ) : (
            <div className="truncate text-[9px] text-neutral-500">
              {s.id === bestId ? "Official source" : `Backs it up · ${signer.role}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
