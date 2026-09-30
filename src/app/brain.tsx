"use client";

import { useEffect, useState } from "react";
import { customer } from "@/lib/knowledge";
import type { AskResult, Client, Evidence, FactStatus, FeedbackKind, Person, ScoredClaim, Claim } from "@/trust-engine";

type Phase = "idle" | "thinking" | "done";
type Hit = Extract<AskResult, { matched: true }>;
type Level = keyof typeof LEVEL;

// DEMO ONLY: who is giving feedback. Replace with the signed-in user.
const DEMO_USER = "sofie";

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

const SUGGESTIONS = [
  { label: "Sick leave relapse", q: customer.question },
  { label: "Indexation 2026", q: "What is the wage indexation in January 2026?" },
  { label: "Meal vouchers", q: "What is the max employer part of a meal voucher?" },
  { label: "Overtime", q: "How long do employees have to take overtime recovery rest?" },
  { label: "End-of-year bonus", q: "When do we pay the end-of-year bonus?" },
  { label: "Holiday pay", q: "How much holiday pay do we owe?" },
];

const VOTES: { kind: FeedbackKind; label: string }[] = [
  { kind: "correct", label: "Correct" },
  { kind: "wrong", label: "Wrong" },
  { kind: "outdated", label: "Outdated" },
  { kind: "not_applicable", label: "Not my case" },
];

const CHANNEL = { official: "Official", teams: "Teams", sharepoint: "SharePoint", email: "Email" } as const;
const pct = (n: number) => Math.round(n * 100);
const firstName = (id: string | null, people: Record<string, Person>) => (id ? people[id]?.name.split(" ")[0] : undefined);
const shortName = (c: Claim, people: Record<string, Person>) =>
  [CHANNEL[c.source.type], firstName(c.author, people)].filter(Boolean).join(" · ");
const shortReason = (reason: string) =>
  reason.startsWith("Applies to PC") ? "Other sector" : reason.startsWith("Applies to") ? "Other country" : reason.startsWith("Specific") ? "Other client" : "Reported n/a";
// The one evidence line that best explains a low or high score.
const keyReason = (c: ScoredClaim) =>
  [...c.evidence].sort((a, b) => (c.score >= 0.5 ? b.points - a.points : a.points - b.points))[0];

export default function Brain() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState(customer.question);
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState("brouwerij-de-kroon");
  const [result, setResult] = useState<AskResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trust/meta").then((r) => r.json()).then((m) => setClients(m.clients));
  }, []);

  async function fetchAnswer(q: string, c: string) {
    const res = await fetch("/api/trust/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, context: { client: c } }),
    });
    return (await res.json()) as AskResult;
  }

  async function ask(q = question, c = client) {
    if (!q.trim()) return;
    setPhase("thinking");
    setSelected(null);
    // Short pause so the rings visibly "read" the sources.
    const [r] = await Promise.all([fetchAnswer(q, c), new Promise((ok) => setTimeout(ok, 700))]);
    setResult(r);
    setPhase("done");
  }

  async function vote(claimId: string, kind: FeedbackKind) {
    await fetch("/api/trust/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-user": DEMO_USER },
      body: JSON.stringify({ claimId, kind, context: { client } }),
    });
    setResult(await fetchAnswer(question, client));
  }

  const hit = result?.matched ? result : null;
  const selectedClaim = hit?.claims.find((c) => c.claim.id === selected) ?? null;

  return (
    <div className="flex flex-col text-[#161616]">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <QuestionCard
          phase={phase}
          question={question}
          onQuestion={setQuestion}
          clients={clients}
          client={client}
          onClient={(c) => {
            setClient(c);
            if (result) ask(question, c);
          }}
          onAsk={(q) => {
            if (q) setQuestion(q);
            ask(q ?? question);
          }}
        />

        <section className="relative overflow-hidden rounded-3xl border border-white bg-[#efefef] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <Graph phase={phase} hit={hit} selected={selected} onSelect={setSelected} />
          <Legend />
        </section>

        {phase === "done" && result && !result.matched && (
          <div className="rounded-2xl bg-white p-4 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p>{result.message} Try one of the suggestions above.</p>
          </div>
        )}
        {phase === "done" && hit &&
          (selectedClaim ? (
            <ClaimPanel c={selectedClaim} people={hit.people} onVote={vote} onClose={() => setSelected(null)} />
          ) : (
            <AnswerCard hit={hit} onVote={vote} onSelect={setSelected} />
          ))}
        {phase === "idle" && (
          <p className="px-1 text-xs leading-relaxed text-neutral-500">
            The brain collects every source that mentions your question, keeps the ones that apply to this client, and scores each one
            in the open. You get one answer, with the reasons behind it.
          </p>
        )}
      </main>
    </div>
  );
}

function QuestionCard({
  phase,
  question,
  onQuestion,
  clients,
  client,
  onClient,
  onAsk,
}: {
  phase: Phase;
  question: string;
  onQuestion: (q: string) => void;
  clients: Client[];
  client: string;
  onClient: (id: string) => void;
  onAsk: (q?: string) => void;
}) {
  const c = clients.find((x) => x.id === client);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAsk();
      }}
      className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
        <span className="rounded-full bg-[#fff4dc] px-2 py-0.5 font-medium text-[#9a6400]">Urgent</span>
        <select
          value={client}
          onChange={(e) => onClient(e.target.value)}
          className="min-w-0 flex-1 cursor-pointer truncate bg-transparent font-medium text-neutral-700 outline-none"
          aria-label="Client"
        >
          {clients.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {c && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest">
            {c.country}
            {c.pc && ` · PC ${c.pc}`}
          </span>
        )}
      </div>
      <textarea
        value={question}
        onChange={(e) => onQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onAsk();
          }
        }}
        rows={3}
        maxLength={500}
        className="w-full resize-none text-sm leading-relaxed outline-none placeholder:text-neutral-400"
        placeholder="Ask anything about payroll, HR or working time…"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onAsk(s.q)}
            className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        disabled={phase === "thinking"}
        className="mt-4 w-full rounded-full bg-[#161616] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
      >
        {phase === "thinking" ? "Reading every source…" : "Ask the company brain"}
      </button>
    </form>
  );
}

/* ---------- Graph ---------- */

type Node = { id: string; label: string; score: number | null; faded: boolean; leaves: { tag: string; ok: boolean }[] };

const W = 800;
const H = 700;
const CX = 400;
const CY = 350;
const R_NODE = 190;
const R_LEAF = 255;
const rad = (d: number) => (d * Math.PI) / 180;
const at = (angle: number, r: number) => ({ x: CX + r * Math.cos(rad(angle)), y: CY + r * Math.sin(rad(angle)) * 0.78 });

const IDLE_NODES: Node[] = ["Official", "Teams", "SharePoint", "Email", "Teams", "SharePoint"].map((label, i) => ({
  id: `idle-${i}`,
  label,
  score: null,
  faded: false,
  leaves: [],
}));

function nodesOf(hit: Hit | null): Node[] {
  if (!hit) return IDLE_NODES;
  const leavesOf = (c: ScoredClaim) =>
    [...c.evidence]
      .filter((e) => e.layer !== "relevance")
      .sort((a, b) => (c.score >= 0.75 ? b.points - a.points : a.points - b.points))
      .slice(0, 2)
      .map((e: Evidence) => ({ tag: e.tag, ok: e.points >= 0 }));
  const relevant = hit.claims.slice(0, 6).map((c) => ({
    id: c.claim.id,
    label: shortName(c.claim, hit.people),
    score: c.score,
    faded: false,
    leaves: leavesOf(c),
  }));
  const excluded = hit.excluded.slice(0, Math.max(0, 8 - relevant.length)).map((e) => ({
    id: e.claim.id,
    label: shortName(e.claim, hit.people),
    score: null,
    faded: true,
    leaves: [{ tag: shortReason(e.reason), ok: false }],
  }));
  return [...relevant, ...excluded];
}

function Graph({ phase, hit, selected, onSelect }: { phase: Phase; hit: Hit | null; selected: string | null; onSelect: (id: string) => void }) {
  const done = phase === "done";
  const nodes = nodesOf(done ? hit : null);
  const angleOf = (i: number) => -90 + (i * 360) / nodes.length;
  return (
    <div className="relative mx-auto aspect-[8/7] w-full max-w-[860px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {nodes.map((n, i) => {
          const angle = angleOf(i);
          const node = at(angle, R_NODE);
          return (
            <g key={n.id} style={{ opacity: n.faded ? 0.5 : 1 }}>
              <line x1={CX} y1={CY} x2={node.x} y2={node.y} stroke="#dcdcdc" strokeWidth={1.5} strokeDasharray={n.faded ? "4 5" : undefined} />
              {n.leaves.map((leaf, j) => {
                const a = n.leaves.length === 1 ? angle : angle + (j === 0 ? -14 : 14);
                const mid = at(a, R_LEAF);
                const tip = at(a, R_LEAF + 35);
                const left = Math.cos(rad(a)) < -0.1;
                const vertical = Math.abs(Math.cos(rad(a))) < 0.5;
                return (
                  <g key={leaf.tag} style={{ opacity: done ? 1 : 0, transition: `opacity 0.5s ${0.4 + i * 0.1}s` }}>
                    <line x1={node.x} y1={node.y} x2={mid.x} y2={mid.y} stroke="#dcdcdc" strokeWidth={1.5} />
                    <line x1={mid.x} y1={mid.y} x2={tip.x} y2={tip.y} stroke="#e4e4e4" strokeWidth={1.5} />
                    <circle cx={tip.x} cy={tip.y} r={5} fill="#dedede" />
                    <circle cx={mid.x} cy={mid.y} r={11} fill={leaf.ok ? "#d6d6d6" : "#f3c0c2"} />
                    <text
                      x={mid.x}
                      y={mid.y}
                      transform={vertical ? undefined : `rotate(${left ? a + 180 : a} ${mid.x} ${mid.y})`}
                      dx={vertical ? (Math.cos(rad(a)) < 0 ? -18 : 18) : left ? -18 : 18}
                      dy={vertical ? 0 : -2}
                      textAnchor={vertical ? (Math.cos(rad(a)) < 0 ? "end" : "start") : left ? "end" : "start"}
                      dominantBaseline="middle"
                      className="text-[15px]"
                      fill={leaf.ok ? "#8a8a8a" : "#c62a30"}
                    >
                      {leaf.tag}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {nodes.map((n, i) => {
        const node = at(angleOf(i), R_NODE);
        const clickable = done && !n.faded;
        return (
          <button
            key={n.id}
            onClick={() => clickable && onSelect(n.id)}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 py-1 pl-1.5 pr-3 text-[12px] font-medium shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition ${
              clickable ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
            } ${selected === n.id ? "ring-2 ring-[#161616]" : ""} ${n.faded ? "opacity-50" : ""}`}
            style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / H) * 100}%` }}
          >
            <Ring phase={phase} score={n.score ?? 0} delay={i * 0.1} />
            <span className={n.faded ? "line-through" : ""}>{n.label}</span>
            {done && n.score !== null && <span className="tabular-nums text-neutral-400">{pct(n.score)}</span>}
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

/* ---------- Answer ---------- */

function AnswerCard({ hit, onVote, onSelect }: { hit: Hit; onVote: (id: string, k: FeedbackKind) => void; onSelect: (id: string) => void }) {
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

function ClaimPanel({
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

function Legend() {
  return (
    <div className="absolute bottom-3 left-4 flex flex-wrap gap-3 text-[11px] text-neutral-500">
      {Object.values(LEVEL).map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
          {l.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-dashed border-neutral-400" />
        Doesn&apos;t apply
      </span>
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
