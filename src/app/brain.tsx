"use client";

import { useMemo, useState } from "react";
import { customer, experts, sources, type Source } from "@/lib/knowledge";
import { scoreSource, type Answer, type Trust } from "@/lib/trust";

type Phase = "idle" | "thinking" | "done";

const LEVEL = {
  trusted: { color: "#1463ff", label: "Trusted", bg: "bg-[#e8efff] text-[#1463ff]" },
  care: { color: "#e39a0b", label: "Use with care", bg: "bg-[#fff4dc] text-[#9a6400]" },
  avoid: { color: "#e5484d", label: "Don't rely on", bg: "bg-[#ffe9ea] text-[#c62a30]" },
} as const;

// Graph geometry, in the SVG's 800x700 coordinate space.
const W = 800;
const H = 700;
const CX = 400;
const CY = 350;
const ANGLES = [-90, -30, 30, 90, 150, 210];
const rad = (d: number) => (d * Math.PI) / 180;
const at = (angle: number, r: number) => ({
  x: CX + r * Math.cos(rad(angle)),
  y: CY + r * Math.sin(rad(angle)) * 0.78,
});

export default function Brain() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [mode, setMode] = useState<"live" | "cached" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [asked, setAsked] = useState(false);

  const trust = useMemo(() => {
    const map: Record<string, Trust> = {};
    for (const s of sources) map[s.id] = scoreSource(s, answer?.readings.find((r) => r.id === s.id));
    return map;
  }, [answer]);

  async function ask() {
    setPhase("thinking");
    setSelected(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", { method: "POST" });
      const data = await res.json();
      setAnswer(data.answer);
      setMode(data.mode);
    } finally {
      setPhase("done");
    }
  }

  const selectedSource = sources.find((s) => s.id === selected) ?? null;

  return (
    <div className="flex flex-col text-[#161616]">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <QuestionCard phase={phase} onAsk={ask} mode={mode} />

        <section className="relative overflow-hidden rounded-3xl border border-white bg-[#efefef] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <Graph phase={phase} trust={trust} selected={selected} onSelect={setSelected} />
          <Legend />
        </section>

        <div className="flex flex-col gap-4">
          {selectedSource ? (
            <SourcePanel
              source={selectedSource}
              trust={trust[selectedSource.id]}
              claim={answer?.readings.find((r) => r.id === selectedSource.id)?.claim}
              flagged={flagged.has(selectedSource.id)}
              onFlag={() => setFlagged(new Set(flagged).add(selectedSource.id))}
              onClose={() => setSelected(null)}
            />
          ) : (
            answer && (
              <AnswerPanel answer={answer} trust={trust} onSelect={setSelected} asked={asked} onAsk={() => setAsked(true)} />
            )
          )}
          {phase === "idle" && (
            <p className="px-1 text-xs leading-relaxed text-neutral-500">
              The brain reads every source and scores it on six signals you can inspect. Click a node to see why.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Graph({
  phase,
  trust,
  selected,
  onSelect,
}: {
  phase: Phase;
  trust: Record<string, Trust>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const done = phase === "done";
  return (
    <div className="relative mx-auto aspect-[8/7] w-full max-w-[860px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {sources.map((s, i) => {
          const angle = ANGLES[i];
          const node = at(angle, 210);
          const t = trust[s.id];
          // Show the signals that most explain the score: failures first.
          const leaves = [...t.signals].sort((a, b) => Number(a.ok) - Number(b.ok)).slice(0, 2);
          return (
            <g key={s.id}>
              <line x1={CX} y1={CY} x2={node.x} y2={node.y} stroke="#dcdcdc" strokeWidth={1.5} />
              {leaves.map((sig, j) => {
                const a = angle + (j === 0 ? -17 : 17);
                const mid = at(a, 285);
                const tip = at(a, 325);
                const left = Math.cos(rad(a)) < -0.1;
                const textAngle = left ? a + 180 : a;
                const vertical = Math.abs(Math.cos(rad(a))) < 0.5;
                return (
                  <g
                    key={sig.key}
                    style={{
                      opacity: done ? 1 : 0,
                      transition: `opacity 0.5s ${0.4 + i * 0.12}s`,
                    }}
                  >
                    <line x1={node.x} y1={node.y} x2={mid.x} y2={mid.y} stroke="#dcdcdc" strokeWidth={1.5} />
                    <line x1={mid.x} y1={mid.y} x2={tip.x} y2={tip.y} stroke="#e4e4e4" strokeWidth={1.5} />
                    <circle cx={tip.x} cy={tip.y} r={5} fill="#dedede" />
                    <circle cx={mid.x} cy={mid.y} r={11} fill={sig.ok ? "#d6d6d6" : "#f3c0c2"} />
                    <text
                      x={mid.x}
                      y={mid.y}
                      transform={vertical ? undefined : `rotate(${textAngle} ${mid.x} ${mid.y})`}
                      dx={vertical ? (left || Math.cos(rad(a)) < 0 ? -18 : 18) : left ? -18 : 18}
                      dy={vertical ? 0 : -2}
                      textAnchor={vertical ? (Math.cos(rad(a)) < 0 ? "end" : "start") : left ? "end" : "start"}
                      dominantBaseline="middle"
                      className="text-[15px]"
                      fill={sig.ok ? "#8a8a8a" : "#c62a30"}
                    >
                      {sig.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {sources.map((s, i) => {
        const node = at(ANGLES[i], 210);
        const t = trust[s.id];
        const isSel = selected === s.id;
        return (
          <button
            key={s.id}
            onClick={() => done && onSelect(s.id)}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 py-1 pl-1.5 pr-3 text-[12px] font-medium shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition ${
              done ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
            } ${isSel ? "ring-2 ring-[#161616]" : ""}`}
            style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / H) * 100}%` }}
          >
            <Ring phase={phase} score={t.score} color={LEVEL[t.level].color} delay={i * 0.12} />
            <span>{s.short}</span>
            {done && <span className="tabular-nums text-neutral-400">{t.score}</span>}
          </button>
        );
      })}

      <div
        className="absolute flex h-[15%] w-[15%] max-h-32 max-w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28%] bg-[#161616] text-white shadow-xl"
        style={{ left: "50%", top: "50%" }}
      >
        <Logo className={`h-3/5 w-3/5 ${phase === "thinking" ? "animate-pulse" : ""}`} />
      </div>
    </div>
  );
}

function Ring({ phase, score, color, delay }: { phase: Phase; score: number; color: string; delay: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const shown = phase === "done" ? score / 100 : phase === "thinking" ? 0.3 : 0;
  return (
    <svg viewBox="0 0 28 28" className={`h-4 w-4 ${phase === "thinking" ? "animate-spin" : ""}`}>
      <circle cx="14" cy="14" r={r} fill="none" stroke="#e3e3e3" strokeWidth="3.5" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={phase === "done" ? color : "#1463ff"}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - shown)}
        transform="rotate(-90 14 14)"
        style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1) ${phase === "done" ? delay : 0}s` }}
      />
    </svg>
  );
}

function QuestionCard({ phase, onAsk, mode }: { phase: Phase; onAsk: () => void; mode: "live" | "cached" | null }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-[#fff4dc] px-2 py-0.5 font-medium text-[#9a6400]">Urgent</span>
        <span className="flex-1">
          {customer.contact} · {customer.company} · {customer.employees} employees
        </span>
        {mode && <span className="text-neutral-400">{mode === "live" ? "Live · Gemini" : "Cached"}</span>}
      </div>
      <p className="text-sm leading-relaxed">“{customer.question}”</p>
      <button
        onClick={onAsk}
        disabled={phase === "thinking"}
        className="mt-4 w-full rounded-full bg-[#161616] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
      >
        {phase === "thinking" ? "Reading 6 sources…" : phase === "done" ? "Ask again" : "Ask the company brain"}
      </button>
    </div>
  );
}

function AnswerPanel({
  answer,
  trust,
  onSelect,
  asked,
  onAsk,
}: {
  answer: Answer;
  trust: Record<string, Trust>;
  onSelect: (id: string) => void;
  asked: boolean;
  onAsk: () => void;
}) {
  const expert = answer.askExpert in experts ? answer.askExpert : "An Peeters";
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">Answer</div>
        <p className="text-[15px] font-semibold leading-snug">{answer.headline}</p>
      </div>

      <ol className="flex flex-col gap-2.5">
        {answer.points.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-neutral-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold">
              {i + 1}
            </span>
            <div>
              {p.text}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {p.sourceIds.map((id) => (
                  <SourceChip key={id} id={id} trust={trust[id]} onSelect={onSelect} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {answer.conflicts.length > 0 && (
        <div className="rounded-2xl bg-[#fff6f6] p-4">
          <div className="mb-1.5 text-xs font-semibold text-[#c62a30]">⚠ Conflicting knowledge found</div>
          {answer.conflicts.map((c, i) => (
            <div key={i} className="text-sm leading-relaxed text-neutral-700">
              {c.summary}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.sourceIds.map((id) => (
                  <SourceChip key={id} id={id} trust={trust[id]} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3">
        <div className="text-sm">
          <div className="font-medium">{expert}</div>
          <div className="text-xs text-neutral-500">{experts[expert as keyof typeof experts]}</div>
        </div>
        <button
          onClick={onAsk}
          disabled={asked}
          className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-neutral-400 disabled:text-neutral-400"
        >
          {asked ? "Sent for review ✓" : "Ask to confirm"}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        <span className="font-medium text-neutral-700">Fix the knowledge: </span>
        {answer.nextAction}
      </p>
    </div>
  );
}

function SourceChip({ id, trust, onSelect }: { id: string; trust: Trust; onSelect: (id: string) => void }) {
  const s = sources.find((x) => x.id === id);
  if (!s) return null;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${LEVEL[trust.level].bg} hover:opacity-80`}
    >
      {s.short} · {trust.score}
    </button>
  );
}

function SourcePanel({
  source,
  trust,
  claim,
  flagged,
  onFlag,
  onClose,
}: {
  source: Source;
  trust: Trust;
  claim?: string;
  flagged: boolean;
  onFlag: () => void;
  onClose: () => void;
}) {
  const level = LEVEL[trust.level];
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-500">
            {source.channel} · {source.country} · {source.date}
          </div>
          <div className="mt-0.5 font-semibold leading-snug">{source.title}</div>
        </div>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700" aria-label="Back to answer">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-4xl font-semibold tabular-nums" style={{ color: level.color }}>
          {trust.score}
        </div>
        <div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${level.bg}`}>{level.label}</span>
          {trust.capReason && <div className="mt-1 text-xs text-neutral-500">{trust.capReason}</div>}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {trust.signals.map((sig) => (
          <li key={sig.key} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                sig.ok ? "bg-[#e8efff] text-[#1463ff]" : "bg-[#ffe9ea] text-[#c62a30]"
              }`}
            >
              {sig.ok ? "✓" : "✕"}
            </span>
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-medium">{sig.label}</span>
                <span className="tabular-nums text-neutral-400">
                  {sig.ok ? `+${sig.weight}` : "0"}
                </span>
              </div>
              <div className="text-xs text-neutral-500">{sig.detail}</div>
            </div>
          </li>
        ))}
      </ul>

      {claim && (
        <div className="rounded-2xl bg-neutral-50 p-3 text-sm">
          <div className="mb-1 text-xs text-neutral-400">What it says</div>
          {claim}
        </div>
      )}
      <details className="text-sm text-neutral-600">
        <summary className="cursor-pointer text-xs text-neutral-400">Full text</summary>
        <p className="mt-2 whitespace-pre-line leading-relaxed">{source.text}</p>
      </details>

      {trust.level !== "trusted" && (
        <button
          onClick={onFlag}
          disabled={flagged}
          className="rounded-full border border-neutral-200 px-3 py-2 text-xs font-medium hover:border-neutral-400 disabled:text-neutral-400"
        >
          {flagged
            ? `Flagged · ${source.owner && source.ownerActive ? source.owner : "Legal Payroll BE"} notified ✓`
            : "Flag for review"}
        </button>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-4 flex flex-wrap gap-3 text-[11px] text-neutral-500">
      {Object.values(LEVEL).map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <circle cx="14" cy="14" r="6" />
      <circle cx="26" cy="14" r="6" />
      <circle cx="14" cy="26" r="6" />
      <circle cx="26" cy="26" r="6" />
    </svg>
  );
}
