"use client";

import { useEffect, useRef, useState } from "react";
import type { Claim, FeedbackKind, ScoredClaim } from "@/trust-engine";
import { CHANNEL, color, Flag, pct, PdfIcon, shortReason, type Hit } from "@/lib/demo-shared";

// The finished answer: one clear value, how the brain decided, and the documents behind it.

type Doc =
  | { kind: "messages"; file: string; messages: { author: string; date: string; text: string }[] }
  | { kind: "text"; file: string; text: string }
  | { kind: "none" };

const VOTES: { kind: FeedbackKind; label: string }[] = [
  { kind: "correct", label: "Correct" },
  { kind: "wrong", label: "Wrong" },
  { kind: "outdated", label: "Outdated" },
  { kind: "not_applicable", label: "Not my case" },
];

const levelWord = (s: number) => (s >= 0.75 ? "Trusted" : s >= 0.5 ? "Use with care" : "Don't rely on");
const sameValue = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, "") === b.toLowerCase().replace(/\s+/g, "");

function useNames(hit: Hit) {
  const name = (c: Claim) => (c.author ? hit.people[c.author]?.name : undefined);
  const label = (c: Claim) => (c.source.type === "teams" ? `Teams · ${name(c)?.split(" ")[0]}` : c.source.title);
  return { name, label };
}

export function Result({
  hit,
  question,
  clientName,
  onVote,
  onNew,
  sorting,
}: {
  hit: Hit;
  question: string;
  clientName: string;
  onVote: (claimId: string, kind: FeedbackKind) => void;
  onNew: () => void;
  sorting: React.ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showSorting, setShowSorting] = useState(false);
  const [asked, setAsked] = useState(false);
  const { name, label } = useNames(hit);
  const { best, fact, status, expert } = hit;

  const others = best ? hit.claims.filter((c) => c.claim.id !== best.claim.id) : [];
  const disagree = best ? others.filter((c) => !sameValue(c.claim.value, best.claim.value)) : [];
  const agree = best ? others.filter((c) => sameValue(c.claim.value, best.claim.value)) : [];
  const trustedCount = hit.claims.filter((c) => c.score >= 0.75).length;
  const reasons = best ? [...best.evidence].filter((e) => e.points > 0).sort((a, b) => b.points - a.points).slice(0, 3) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-neutral-400">You asked · {clientName}</div>
          <div className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{question}</div>
        </div>
        <button onClick={onNew} className="shrink-0 rounded-full bg-[#161616] px-4 py-2 text-sm font-medium text-white hover:bg-black">
          New question
        </button>
      </div>

      {/* The answer */}
      {!best ? (
        <div className="rounded-3xl bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{fact.label}</div>
          <p className="mt-3 text-lg">Nothing in the company&apos;s knowledge applies to {clientName} yet.</p>
          <p className="mt-1 text-sm text-neutral-500">{hit.excluded.length} sources exist, but for other countries, sectors or clients.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-neutral-400">{fact.label}</div>
              <div className="mt-2 font-serif text-6xl leading-none tracking-tight">{best.claim.value}</div>
              {status === "conflict" && disagree[0] && (
                <div className="mt-3 text-sm text-[#c62a30]">
                  Experts disagree: {label(disagree[0].claim)} says {disagree[0].claim.value}. Check before you answer.
                </div>
              )}
              {status === "orphan" && <div className="mt-3 text-sm text-neutral-500">No expert or official source backs this yet.</div>}
            </div>
            <ScoreRing score={best.score} />
          </div>

          <button
            onClick={() => setOpen(best.claim.id)}
            className="group mt-6 block w-full rounded-2xl bg-neutral-50 p-4 text-left transition hover:bg-neutral-100"
          >
            <p className="text-[15px] leading-relaxed text-neutral-800">“{best.claim.text}”</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
              <SourceIcon c={best.claim} />
              <span className="truncate">
                {best.claim.source.title}
                {name(best.claim) && ` · ${name(best.claim)}`} · {best.claim.effectiveFrom ?? best.claim.date}
              </span>
              <span className="ml-auto shrink-0 font-medium text-[#1463ff] group-hover:underline">Open document →</span>
            </div>
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Votes onVote={(k) => onVote(best.claim.id, k)} />
            {expert && (
              <button
                onClick={() => setAsked(true)}
                disabled={asked}
                className="text-xs text-neutral-500 hover:text-neutral-900 disabled:text-neutral-400"
              >
                {asked ? `Sent to ${expert.name} ✓` : `Ask ${expert.name} to confirm →`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* How the brain decided */}
      <div>
        <h2 className="font-serif text-2xl">How the brain decided</h2>
        <ol className="mt-4 flex flex-col gap-5">
          <Step n={1} title={`Found ${hit.claims.length + hit.excluded.length} sources that mention ${fact.label.toLowerCase()}`}>
            <span className="text-neutral-500">Official texts, SharePoint documents, Teams messages and emails.</span>
          </Step>
          {hit.excluded.length > 0 && (
            <Step n={2} title={`Set aside ${hit.excluded.length} that don't apply to ${clientName}`}>
              <Chips>
                {hit.excluded.map((e) => (
                  <Chip key={e.claim.id} onClick={() => setOpen(e.claim.id)} muted>
                    {label(e.claim)} · {shortReason(e.reason).toLowerCase()}
                  </Chip>
                ))}
              </Chips>
            </Step>
          )}
          <Step n={hit.excluded.length ? 3 : 2} title={`Scored ${hit.excluded.length ? "the other" : "all"} ${hit.claims.length} on six trust layers`}>
            <span className="text-neutral-500">
              Who wrote it, how recent it is, who agrees, whether it matches the law, whether it fits this client, and user feedback.{" "}
              {trustedCount} passed the 75% bar.
            </span>
          </Step>
          {best && (
            <Step n={hit.excluded.length ? 4 : 3} title={`Picked ${label(best.claim)}`}>
              <span className="text-neutral-500">{reasons.map((r) => r.label).join(" · ")}</span>
              {agree.length > 0 && (
                <Chips>
                  {agree.map((c) => (
                    <Chip key={c.claim.id} onClick={() => setOpen(c.claim.id)} score={c.score}>
                      Agrees · {label(c.claim)}
                    </Chip>
                  ))}
                </Chips>
              )}
            </Step>
          )}
          {disagree.length > 0 && (
            <Step n="!" title={`${disagree.length} source${disagree.length > 1 ? "s" : ""} said something else`} warn>
              <Chips>
                {disagree.map((c) => (
                  <Chip key={c.claim.id} onClick={() => setOpen(c.claim.id)} score={c.score}>
                    {c.claim.value} · {label(c.claim)} · {why(c, best!)}
                  </Chip>
                ))}
              </Chips>
            </Step>
          )}
        </ol>
        <button onClick={() => setShowSorting(!showSorting)} className="mt-6 text-xs text-neutral-500 hover:text-neutral-900">
          {showSorting ? "Hide the sorting ▴" : "Show how the documents were sorted ▾"}
        </button>
        {showSorting && <div className="mt-4">{sorting}</div>}
      </div>

      {open && <DocViewer key={open} id={open} hit={hit} onClose={() => setOpen(null)} onOpen={setOpen} onVote={onVote} />}
    </div>
  );
}

const SPECIFIC = { client: 2, sector: 1, country: 0 } as const;
// Why a source that says something else lost, in a few words.
function why(c: ScoredClaim, best: ScoredClaim) {
  if (SPECIFIC[c.relevance] < SPECIFIC[best.relevance]) return "general rule, the client agreement overrides it";
  const neg = [...c.evidence].filter((e) => e.points < 0).sort((a, b) => a.points - b.points)[0];
  return neg ? neg.tag.toLowerCase() : "less support";
}

function Step({ n, title, warn, children }: { n: number | string; title: string; warn?: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          warn ? "bg-[#fff4dc] text-[#9a6400]" : "bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        }`}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">{title}</div>
        <div className="mt-1 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

const Chips = ({ children }: { children: React.ReactNode }) => <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>;

function Chip({ children, onClick, score, muted }: { children: React.ReactNode; onClick: () => void; score?: number; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition hover:border-neutral-400 ${
        muted ? "border-neutral-200 text-neutral-400" : "border-neutral-200 bg-white text-neutral-700"
      }`}
    >
      {score !== undefined && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(score) }} />}
      {children}
      {score !== undefined && <span className="tabular-nums text-neutral-400">{pct(score)}%</span>}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#eee" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color(score)}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - score)}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums" style={{ color: color(score) }}>
          {pct(score)}
        </span>
      </div>
      <span className="mt-1 text-xs text-neutral-500">{levelWord(score)}</span>
    </div>
  );
}

function SourceIcon({ c }: { c: Claim }) {
  return c.source.type === "official" ? <Flag country={c.scope.country} size={10} /> : <PdfIcon />;
}

function Votes({ onVote }: { onVote: (k: FeedbackKind) => void }) {
  const [sent, setSent] = useState<FeedbackKind | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-1 text-neutral-500">{sent ? "Thanks, the score is updated" : "Was this right?"}</span>
      {VOTES.map((v) => (
        <button
          key={v.kind}
          onClick={() => {
            setSent(v.kind);
            onVote(v.kind);
          }}
          className={`rounded-full border px-2.5 py-1 transition ${
            sent === v.kind ? "border-[#161616] bg-[#161616] text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- The actual document, with the sentence the brain used ---------- */

function DocViewer({
  id,
  hit,
  onClose,
  onOpen,
  onVote,
}: {
  id: string;
  hit: Hit;
  onClose: () => void;
  onOpen: (id: string) => void;
  onVote: (claimId: string, kind: FeedbackKind) => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const markRef = useRef<HTMLElement>(null);
  const { name, label } = useNames(hit);
  const scored = hit.claims.find((c) => c.claim.id === id);
  const excluded = hit.excluded.find((e) => e.claim.id === id);
  const claim = (scored?.claim ?? excluded?.claim)!;
  const author = claim.author ? hit.people[claim.author] : undefined;
  const related = hit.claims.filter((c) => c.claim.id !== id);

  useEffect(() => {
    fetch(`/api/trust/source?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then(setDoc);
  }, [id]);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doc]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <SourceIcon c={claim} />
              {CHANNEL[claim.source.type]} · {claim.scope.country}
              {claim.scope.pc && ` · PC ${claim.scope.pc}`} · {claim.effectiveFrom ?? claim.date}
            </div>
            <div className="mt-1 text-lg font-semibold leading-snug">{claim.source.title}</div>
            <div className="text-sm text-neutral-500">
              {author ? `${author.name} · ${author.left ? "left the company" : author.role === "new" ? "new hire" : author.team}` : "Official publication"}
            </div>
            {doc && doc.kind !== "none" && <div className="mt-1 font-mono text-[11px] text-neutral-400">{doc.file.split("/").pop()}</div>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800" aria-label="Close">
              ✕
            </button>
            {scored ? (
              <span className="text-2xl font-semibold tabular-nums" style={{ color: color(scored.score) }}>
                {pct(scored.score)}%
              </span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Doesn&apos;t apply</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {excluded && <p className="mb-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">Set aside: {excluded.reason}.</p>}
          {!doc ? (
            <p className="text-sm text-neutral-400">Opening document…</p>
          ) : doc.kind === "messages" ? (
            <div className="flex flex-col gap-3">
              {doc.messages.map((m, i) => {
                const hitMsg = m.text.includes(claim.text.slice(0, 40)) || (m.author === name(claim) && m.date.startsWith(claim.date));
                return (
                  <div key={i} className={`rounded-2xl p-3 text-sm ${hitMsg ? "bg-[#e8efff] ring-1 ring-[#1463ff]/30" : "bg-neutral-50"}`}>
                    <div className="mb-1 text-xs text-neutral-500">
                      {m.author} · {m.date.slice(0, 10)}
                    </div>
                    {hitMsg ? <mark ref={markRef} className="bg-transparent">{m.text}</mark> : m.text}
                  </div>
                );
              })}
            </div>
          ) : doc.kind === "text" ? (
            <Highlighted text={doc.text} quote={claim.text} value={claim.value} markRef={markRef} />
          ) : (
            <div className="text-sm">
              <div className="mb-2 text-xs text-neutral-400">Excerpt (no file in the demo data)</div>
              <mark className="rounded bg-[#cfe0ff] px-1">{claim.text}</mark>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 p-6">
          {related.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-wide text-neutral-400">What other sources say</div>
              <Chips>
                {related.map((c) => (
                  <Chip key={c.claim.id} onClick={() => onOpen(c.claim.id)} score={c.score}>
                    {sameValue(c.claim.value, claim.value) ? "Agrees" : c.claim.value} · {label(c.claim)}
                  </Chip>
                ))}
              </Chips>
            </>
          )}
          {scored && (
            <div className="mt-4">
              <Votes onVote={(k) => onVote(claim.id, k)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Plain-text document with the sentence the brain used highlighted.
// Tolerant of line breaks inside the sentence and of 1,8% vs 1.8%.
function Highlighted({ text, quote, value, markRef }: { text: string; quote: string; value: string; markRef: React.RefObject<HTMLElement | null> }) {
  const pattern = (s: string) =>
    new RegExp(
      s
        .replace(/…$/, "")
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\.|,/g, "[.,]"))
        .join("\\s+"),
      "i",
    );
  const m = pattern(quote).exec(text) ?? pattern(value).exec(text);
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-700">
      {!m ? (
        text
      ) : (
        <>
          {text.slice(0, m.index)}
          <mark ref={markRef} className="rounded bg-[#cfe0ff] px-0.5 text-[#161616]">
            {m[0]}
          </mark>
          {text.slice(m.index + m[0].length)}
        </>
      )}
    </pre>
  );
}
