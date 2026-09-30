"use client";

import { STATUS, type ScoredClaim } from "@/trust-engine";
import { color, Flag, pct, PdfIcon, seg, shortReason, type DocCard, type Hit } from "@/lib/demo-shared";

// Trust funnel: the real sources for this question move left to right through the trust engine's
// six layers and get fewer. `q` runs 0 → 1.

const LAYERS = [
  { key: "authority", name: "Authority", q: "Who said it?" },
  { key: "freshness", name: "Freshness", q: "When?" },
  { key: "corroboration", name: "Corroboration", q: "Who agrees?" },
  { key: "consistency", name: "Consistency", q: "Matches the law?" },
  { key: "relevance", name: "Relevance", q: "Fits this client?" },
  { key: "feedback", name: "Feedback", q: "Did it work?" },
];

// Columns as % of the stage width; h = preferred card height.
const COLS = [
  { x: 0, w: 17, h: 32, label: "Found" },
  { x: 20, w: 41, h: 60, label: "Applies to this case" },
  { x: 64, w: 17, h: 54, label: "Trusted ≥ 75%" },
  { x: 84, w: 16, h: 150, label: "Read this first" },
];
const BAND_TOP = 44;
const BAND_BOTTOM = 362;
const DROP_TOP = 380;
const DROP_H = 30;
const GAP = 5;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

type Place = { col: number; mode: "found" | "scoring" | "trusted" | "best" | "dropped"; reason?: string };

export const funnelStage = (q: number) => (q < 0.1 ? 0 : q < 0.65 ? 1 : q < 0.82 ? 2 : 3);

export default function Funnel({ hit, cards, q, onSelect }: { hit: Hit; cards: DocCard[]; q: number; onSelect: (id: string) => void }) {
  const appear = seg(q, 0, 0.06);
  const stage = funnelStage(q);
  const layers = stage === 1 ? Math.min(6, Math.floor(seg(q, 0.12, 0.6) * 6.999)) : stage > 1 ? 6 : 0;

  const scored = (id: string): ScoredClaim | undefined => hit.claims.find((c) => c.claim.id === id);
  const excluded = (id: string) => hit.excluded.find((e) => e.claim.id === id);
  const bestId = hit.best?.claim.id;

  function placeOf(id: string): Place {
    if (stage === 0) return { col: 0, mode: "found" };
    const ex = excluded(id);
    if (ex) return { col: 0, mode: "dropped", reason: shortReason(ex.reason) };
    if (stage === 1) return { col: 1, mode: "scoring" };
    const sc = scored(id)!;
    if (id === bestId) return stage === 3 ? { col: 3, mode: "best" } : sc.score >= STATUS.trusted ? { col: 2, mode: "trusted" } : { col: 1, mode: "scoring" };
    if (sc.score < STATUS.trusted) return { col: 1, mode: "dropped", reason: `${pct(sc.score)}% · ${keyReason(sc)}` };
    return { col: 2, mode: "trusted" };
  }

  const places = Object.fromEntries(cards.map((c) => [c.id, placeOf(c.id)]));
  const layout = (id: string) => {
    const pl = places[id];
    const col = COLS[pl.col];
    const dropped = pl.mode === "dropped";
    const same = cards.filter((c) => places[c.id].col === pl.col && (places[c.id].mode === "dropped") === dropped);
    const k = same.findIndex((c) => c.id === id);
    if (dropped) return { left: col.x, width: col.w, top: DROP_TOP + k * (DROP_H + 4), height: DROP_H };
    // Shrink cards when many share a column so they stay inside the funnel.
    const h = Math.min(col.h, (BAND_BOTTOM - BAND_TOP - (same.length - 1) * GAP) / same.length);
    const total = same.length * h + (same.length - 1) * GAP;
    return { left: col.x, width: col.w, top: (BAND_TOP + BAND_BOTTOM) / 2 - total / 2 + k * (h + GAP), height: h };
  };

  const maxDropped = Math.max(0, ...[0, 1].map((col) => cards.filter((c) => places[c.id].col === col && places[c.id].mode === "dropped").length));
  const trustedCount = hit.claims.filter((c) => c.score >= STATUS.trusted).length;
  const counts = [cards.length, hit.claims.length, trustedCount, hit.best ? 1 : 0];

  return (
    <div className="flex flex-col">
      {/* The six criteria from the trust engine, lit as each one is applied */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {LAYERS.map((l, i) => {
          const on = layers > i;
          const current = stage === 1 && layers - 1 === i;
          return (
            <div
              key={l.key}
              className={`rounded-xl px-2.5 py-2 transition-all duration-300 ${on ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : "bg-white/40"} ${
                current ? "ring-2 ring-[#1463ff]" : ""
              }`}
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
      <div className="relative mt-4" style={{ opacity: appear, height: DROP_TOP + maxDropped * (DROP_H + 4) + 8 }}>
        <svg viewBox="0 0 100 460" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[460px] w-full" aria-hidden>
          <polygon points="0,44 18.5,44 62.5,80 82.5,120 100,120 100,290 82.5,290 62.5,330 18.5,362 0,362" fill="#fff" fillOpacity="0.35" />
          {[18.5, 62.5, 82.5].map((x) => (
            <line key={x} x1={x} x2={x} y1={30} y2={362} stroke="#b9b6b0" strokeWidth="0.15" strokeDasharray="1 1.5" />
          ))}
          <line x1="0" x2="100" y1="370" y2="370" stroke="#cfccc6" strokeWidth="0.1" />
        </svg>

        {COLS.map((c, i) => (
          <div
            key={c.label}
            className={`absolute top-0 font-mono text-[9px] uppercase tracking-widest transition-colors ${
              i === stage ? "text-[#161616]" : "text-neutral-400"
            }`}
            style={{ left: `${c.x}%`, width: `${c.w}%` }}
          >
            {c.label} <span className="text-[#1463ff]">· {counts[i]}</span>
          </div>
        ))}
        {stage > 0 && maxDropped > 0 && (
          <div className="absolute font-mono text-[9px] uppercase tracking-widest text-neutral-400" style={{ top: DROP_TOP - 14, left: 0 }}>
            Set aside
          </div>
        )}

        {cards.map((c) => (
          <Card
            key={c.id}
            card={c}
            sc={scored(c.id)}
            place={places[c.id]}
            box={layout(c.id)}
            layers={layers}
            conflict={hit.status === "conflict"}
            onClick={stage === 3 && scored(c.id) ? () => onSelect(c.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// The evidence line that pulls a score down the most.
const keyReason = (sc: ScoredClaim) => [...sc.evidence].sort((a, b) => a.points - b.points)[0]?.tag ?? "";

function Card({
  card: s,
  sc,
  place,
  box,
  layers,
  conflict,
  onClick,
}: {
  card: DocCard;
  sc?: ScoredClaim;
  place: Place;
  box: { left: number; width: number; top: number; height: number };
  layers: number;
  conflict: boolean;
  onClick?: () => void;
}) {
  const shownLayers = LAYERS.slice(0, layers).map((l) => l.key);
  const evidence = sc?.evidence.filter((e) => shownLayers.includes(e.layer)) ?? [];
  // Score builds up layer by layer; after the last layer the engine's capped score is final.
  const score = !sc || layers === 0 ? null : layers >= 6 ? sc.score : sigmoid(evidence.reduce((sum, e) => sum + e.points, 0));
  const icon = s.official ? <Flag country={s.country} size={10} /> : <PdfIcon />;
  const compact = box.height < 44;

  return (
    <div
      onClick={onClick}
      className={`absolute overflow-hidden rounded-xl transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
        place.mode === "dropped"
          ? "bg-white/50"
          : place.mode === "best"
            ? "bg-white shadow-[0_12px_40px_-12px_rgba(20,99,255,0.45)] ring-2 ring-[#1463ff]"
            : "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      } ${onClick ? "cursor-pointer hover:ring-2 hover:ring-[#161616]/30" : ""}`}
      style={{ left: `${box.left}%`, width: `${box.width}%`, top: box.top, height: box.height }}
    >
      {place.mode === "dropped" ? (
        <div className="flex h-full flex-col justify-center px-2 leading-tight">
          <span className="truncate text-[10px] text-neutral-400 line-through">{s.short}</span>
          <span className="truncate text-[9px] text-[#c62a30]">{place.reason}</span>
        </div>
      ) : place.mode === "best" && sc ? (
        <div className="flex h-full flex-col p-2.5">
          <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: conflict ? "#c62a30" : "#1463ff" }}>
            {conflict ? "Check with expert" : "Open this"}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {icon}
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">{s.short}</span>
          </div>
          <div className="mt-1 font-serif text-3xl leading-none" style={{ color: color(sc.score) }}>
            {pct(sc.score)}%
          </div>
          <div className="mt-1 line-clamp-3 text-[9px] leading-snug text-neutral-500">
            Says <b className="text-[#161616]">{sc.claim.value}</b> ·{" "}
            {s.official ? `official, in force since ${sc.claim.effectiveFrom}` : `${s.signer.role}, ${sc.claim.date}`}
          </div>
          <div className="mt-auto -rotate-2 truncate font-signature text-[15px] leading-none text-[#1f3a8a]">{s.signer.name}</div>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-1 px-2.5">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="truncate text-[11px] font-medium">{s.short}</span>
            {place.mode === "scoring" && !compact && (
              <span className="ml-1 hidden truncate font-signature text-[13px] leading-none text-[#1f3a8a] sm:inline">{s.signer.name}</span>
            )}
            {place.mode !== "found" && score !== null && (
              <span className="ml-auto shrink-0 font-serif text-lg leading-none tabular-nums" style={{ color: color(score) }}>
                {pct(score)}
              </span>
            )}
          </div>
          {!compact &&
            (place.mode === "found" ? (
              <div className="truncate text-[9px] text-neutral-400">
                {s.signer.name} · {s.date.slice(0, 7)}
              </div>
            ) : place.mode === "scoring" ? (
              <div className="flex max-h-[34px] flex-wrap gap-1 overflow-hidden">
                {evidence.length === 0 && (
                  <span className="text-[9px] text-neutral-400">
                    {s.signer.role} · {s.date.slice(0, 7)}
                  </span>
                )}
                {evidence.map((e, i) => (
                  <span
                    key={i}
                    className={`shrink-0 rounded-full px-1.5 py-px text-[9px] ${e.points >= 0 ? "bg-[#e8efff] text-[#1463ff]" : "bg-[#ffe9ea] text-[#c62a30]"}`}
                  >
                    {e.points > 0 ? "+" : ""}
                    {e.points} {e.tag}
                  </span>
                ))}
              </div>
            ) : (
              <div className="truncate text-[9px] text-neutral-500">Backs it up · {s.signer.role}</div>
            ))}
        </div>
      )}
    </div>
  );
}
