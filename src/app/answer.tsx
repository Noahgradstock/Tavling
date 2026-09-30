"use client";

import { useState } from "react";
import type { FactStatus, FeedbackKind, Person, ScoredClaim, Claim } from "@/trust-engine";
import { CHANNEL, pct, type Hit } from "@/lib/demo-shared";

// The answer: one value with its trust score, details on demand, feedback and the expert to ask.

type Level = keyof typeof LEVEL;
type Phase = "idle" | "thinking" | "done";

const LEVEL = {
  trusted: { color: "#1463ff", label: "Trusted", bg: "bg-[#e8efff] text-[#1463ff]" },
  care: { color: "#e39a0b", label: "Use with care", bg: "bg-[#fff4dc] text-[#9a6400]" },
  avoid: { color: "#e5484d", label: "Don't rely on", bg: "bg-[#ffe9ea] text-[#c62a30]" },
} as const;
const levelOf = (score: number): Level => (score >= 0.75 ? "trusted" : score >= 0.5 ? "care" : "avoid");

const STATUS: Record<FactStatus, { label: string; bg: string }> = {
  trusted: { label: "Trusted", bg: LEVEL.trusted.bg },
  conflict: { label: "Experts disagree", bg: LEVEL.avoid.bg },
  stale: { label: "Getting stale", bg: LEVEL.care.bg },
  orphan: { label: "Unverified", bg: "bg-neutral-100 text-neutral-600" },
};

const VOTES: { kind: FeedbackKind; label: string }[] = [
  { kind: "correct", label: "Correct" },
  { kind: "wrong", label: "Wrong" },
  { kind: "outdated", label: "Outdated" },
  { kind: "not_applicable", label: "Not my case" },
];

const firstName = (id: string | null, people: Record<string, Person>) => (id ? people[id]?.name.split(" ")[0] : undefined);
const shortName = (c: Claim, people: Record<string, Person>) =>
  [CHANNEL[c.source.type], firstName(c.author, people)].filter(Boolean).join(" · ");
// The one evidence line that best explains a low or high score.
const keyReason = (c: ScoredClaim) =>
  [...c.evidence].sort((a, b) => (c.score >= 0.5 ? b.points - a.points : a.points - b.points))[0];

export function AnswerCard({ hit, onVote, onSelect }: { hit: Hit; onVote: (id: string, k: FeedbackKind) => void; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const { best, fact, status, people, expert } = hit;

  if (!best) {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{fact.label}</div>
        Nothing in the brain applies to this client yet.
        {hit.excluded.length > 0 && <span className="text-neutral-500"> {hit.excluded.length} sources exist for other countries or sectors.</span>}
      </div>
    );
  }

  const others = hit.claims.filter((c) => c.claim.id !== best.claim.id);
  const disagreeing = others.filter((c) => c.claim.value.toLowerCase() !== best.claim.value.toLowerCase());
  const rival = status === "conflict" ? disagreeing[0] : null;
  const level = LEVEL[levelOf(best.score)];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">{fact.label}</div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[status].bg}`}>{STATUS[status].label}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-serif text-5xl leading-none tracking-tight">{best.claim.value}</div>
          {rival && (
            <div className="mt-2 text-sm text-neutral-500">
              or <span className="font-medium text-neutral-800">{rival.claim.value}</span> according to {shortName(rival.claim, people)} ({pct(rival.score)}%)
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative">
            <Ring phase="done" score={best.score} delay={0} size="h-16 w-16" />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums" style={{ color: level.color }}>
              {pct(best.score)}
            </span>
          </div>
          <span className="mt-1 text-[11px] text-neutral-500">trust score</span>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-neutral-700">{best.claim.text}</p>

      <div className="text-xs text-neutral-500">
        {best.claim.source.title}
        {best.claim.author && ` · ${people[best.claim.author]?.name}`} · {best.claim.date}
      </div>

      {status === "orphan" && (
        <p className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">No expert or official source backs this yet. Treat it as a lead, not an answer.</p>
      )}
      {!open && disagreeing.length > 0 && status !== "conflict" && (
        <button onClick={() => setOpen(true)} className="text-left text-xs text-[#9a6400] hover:underline">
          ⚠ {disagreeing.length} other source{disagreeing.length > 1 ? "s say" : " says"} something else, and scored lower. See why
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <Votes onVote={(k) => onVote(best.claim.id, k)} />
        <button onClick={() => setOpen(!open)} className="text-xs font-medium text-neutral-700 hover:text-black">
          {open ? "Hide details ▴" : "Why this answer? ▾"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4">
          <Section title={`Why ${pct(best.score)}%`}>
            <EvidenceList c={best} />
          </Section>

          {others.length > 0 && (
            <Section title="Other sources">
              {others.map((c) => (
                <SourceRow key={c.claim.id} c={c} people={people} onClick={() => onSelect(c.claim.id)} />
              ))}
            </Section>
          )}

          {hit.excluded.length > 0 && (
            <Section title="Don't apply to this client">
              {hit.excluded.map((e) => (
                <div key={e.claim.id} className="flex items-center justify-between gap-3 py-1 text-sm text-neutral-400">
                  <span className="truncate line-through">
                    {e.claim.value} · {shortName(e.claim, people)}
                  </span>
                  <span className="shrink-0 text-xs">{e.reason}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {expert && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3">
          <div className="text-sm">
            <div className="font-medium">{expert.name}</div>
            <div className="text-xs text-neutral-500">{expert.team} · expert on this topic</div>
          </div>
          <button
            onClick={() => setConfirmSent(true)}
            disabled={confirmSent}
            className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-neutral-400 disabled:text-neutral-400"
          >
            {confirmSent ? "Sent for review ✓" : status === "conflict" ? "Ask to settle it" : "Ask to confirm"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ClaimPanel({
  c,
  people,
  onVote,
  onClose,
}: {
  c: ScoredClaim;
  people: Record<string, Person>;
  onVote: (id: string, k: FeedbackKind) => void;
  onClose: () => void;
}) {
  const level = LEVEL[levelOf(c.score)];
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-500">
            {CHANNEL[c.claim.source.type]} · {c.claim.scope.country}
            {c.claim.scope.pc && ` · PC ${c.claim.scope.pc}`} · {c.claim.date}
          </div>
          <div className="mt-0.5 font-semibold leading-snug">{c.claim.source.title}</div>
          {c.claim.author && <div className="text-xs text-neutral-500">{people[c.claim.author]?.name}</div>}
        </div>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700" aria-label="Back to answer">
          ✕
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-4xl font-semibold tabular-nums" style={{ color: level.color }}>
          {pct(c.score)}
        </div>
        <div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${level.bg}`}>{level.label}</span>
          <div className="mt-1 text-sm">
            Says <span className="font-medium">{c.claim.value}</span>
          </div>
        </div>
      </div>
      <p className="rounded-2xl bg-neutral-50 p-3 text-sm italic text-neutral-700">“{c.claim.text}”</p>
      <EvidenceList c={c} />
      <div className="border-t border-neutral-100 pt-3">
        <Votes onVote={(k) => onVote(c.claim.id, k)} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">{title}</div>
      {children}
    </div>
  );
}

function EvidenceList({ c }: { c: ScoredClaim }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {c.evidence.map((e) => (
        <li key={e.layer + e.label} className="flex items-center gap-2.5 text-sm">
          <span
            className={`w-11 shrink-0 rounded-full py-0.5 text-center text-[11px] font-medium tabular-nums ${
              e.points >= 0 ? "bg-[#e8efff] text-[#1463ff]" : "bg-[#ffe9ea] text-[#c62a30]"
            }`}
          >
            {e.points > 0 ? "+" : ""}
            {e.points}
          </span>
          <span className="text-neutral-700">{e.label}</span>
        </li>
      ))}
      {c.caps.map((cap) => (
        <li key={cap} className="text-xs text-[#c62a30]">
          {cap}
        </li>
      ))}
    </ul>
  );
}

function SourceRow({ c, people, onClick }: { c: ScoredClaim; people: Record<string, Person>; onClick: () => void }) {
  const reason = keyReason(c);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left text-sm hover:bg-neutral-50">
      <Ring phase="done" score={c.score} delay={0} />
      <span className="w-20 shrink-0 font-medium">{c.claim.value}</span>
      <span className="min-w-0 flex-1 truncate text-neutral-500">{shortName(c.claim, people)}</span>
      {reason && <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">{reason.tag}</span>}
      <span className="w-9 shrink-0 text-right tabular-nums text-neutral-400">{pct(c.score)}</span>
    </button>
  );
}

function Votes({ onVote }: { onVote: (k: FeedbackKind) => void }) {
  const [sent, setSent] = useState<FeedbackKind | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-1 text-neutral-500">{sent ? "Thanks, score updated" : "Was this right?"}</span>
      {VOTES.map((v) => (
        <button
          key={v.kind}
          onClick={() => {
            setSent(v.kind);
            onVote(v.kind);
          }}
          className={`rounded-full border px-2 py-0.5 transition ${
            sent === v.kind ? "border-[#161616] bg-[#161616] text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function Ring({ phase, score, delay, size = "h-4 w-4" }: { phase: Phase; score: number; delay: number; size?: string }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const shown = phase === "done" ? score : phase === "thinking" ? 0.3 : 0;
  return (
    <svg viewBox="0 0 28 28" className={`${size} shrink-0 ${phase === "thinking" ? "animate-spin" : ""}`}>
      <circle cx="14" cy="14" r={r} fill="none" stroke="#e3e3e3" strokeWidth="3.5" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={phase === "done" ? LEVEL[levelOf(score)].color : "#1463ff"}
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

