"use client";

import { useState } from "react";
import type { ScoredClaim } from "@/trust-engine";
import { CHANNEL, color, pct, type Hit } from "@/lib/demo-shared";

export type Privacy = { masked: string; redactions: { label: string; count: number }[]; sentToAi: boolean };

// GDPR: shows exactly what an AI model gets to see of the question.
export function PrivacyNote({ privacy }: { privacy: Privacy }) {
  const parts = privacy.masked.split(/(⟦[^⟧]+⟧)/);
  const n = privacy.redactions.reduce((s, r) => s + r.count, 0);
  return (
    <div className="mx-auto mt-2 flex max-w-2xl items-start gap-2.5 rounded-xl bg-white/60 px-3 py-2 text-[11px] leading-relaxed">
      <span className="mt-px shrink-0" aria-hidden>
        🔒
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
          What the AI sees · {n ? `${n} personal detail${n > 1 ? "s" : ""} masked` : "no personal data found"}
        </div>
        <p className="text-neutral-600">
          {parts.map((part, i) =>
            part.startsWith("⟦") ? (
              <span key={i} className="mx-0.5 rounded bg-[#161616] px-1.5 py-px font-mono text-[9px] text-white">
                {part.slice(1, -1)}
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </p>
      </div>
      <span className="shrink-0 text-[10px] text-neutral-500">
        {privacy.sentToAi ? "Sent to Gemini masked" : "Stayed on our server"}
      </span>
    </div>
  );
}

const CONNECTORS = [
  { name: "Microsoft Teams", what: "#payroll-be and 3 more channels", icon: "💬" },
  { name: "SharePoint", what: "Payroll manuals and policies", icon: "📁" },
  { name: "Outlook", what: "Shared legal and client mailboxes", icon: "✉️" },
  { name: "Official sources", what: "Belgian Official Journal · EUR-Lex", icon: "⚖️" },
];

// Where the brain's knowledge comes from.
export function Connectors() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONNECTORS.map((c) => (
          <div key={c.name} className="rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between">
              <span aria-hidden>{c.icon}</span>
              <span className="flex items-center gap-1 text-[9px] text-neutral-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22a06b]" />
                Connected
              </span>
            </div>
            <div className="mt-1.5 text-[12px] font-medium">{c.name}</div>
            <div className="text-[10px] leading-snug text-neutral-500">{c.what}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] leading-relaxed text-neutral-500">
        Read-only connectors: every user only sees what they already have access to. Personal data is masked before any AI sees it.
        This demo reads sample exports from <span className="font-mono">data/salary</span>.
      </p>
    </div>
  );
}

// Numbered references: the exact lines in the source files the answer is grounded in.
export function References({ hit, onSelect }: { hit: Hit; onSelect: (id: string) => void }) {
  const best = hit.best;
  if (!best) return null;
  const same = (c: ScoredClaim) => c.claim.value.toLowerCase() === best.claim.value.toLowerCase();
  const refs = [best, ...hit.claims.filter((c) => c.claim.id !== best.claim.id && same(c))];
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">Grounded in</div>
      <ol className="flex flex-col gap-1.5">
        {refs.map((c, i) => (
          <li key={c.claim.id}>
            <button
              onClick={() => onSelect(c.claim.id)}
              className="flex w-full gap-2.5 rounded-xl bg-neutral-50 p-2.5 text-left transition hover:bg-neutral-100"
            >
              <span className="mt-px font-mono text-[11px] text-[#1463ff]">[{i + 1}]</span>
              <div className="min-w-0 flex-1">
                <Quote text={c.claim.text} value={c.claim.value} />
                <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                  <span className="truncate font-mono">{c.claim.file ?? c.claim.source.title}</span>
                  <span className="shrink-0">
                    {CHANNEL[c.claim.source.type]}
                    {c.claim.author && ` · ${hit.people[c.claim.author]?.name}`} · {c.claim.date}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-medium tabular-nums" style={{ color: color(c.score) }}>
                {pct(c.score)}%
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Quote({ text, value }: { text: string; value: string }) {
  const i = text.toLowerCase().indexOf(value.toLowerCase());
  if (i < 0) return <p className="text-[12px] italic leading-relaxed text-neutral-700">“{text}”</p>;
  return (
    <p className="text-[12px] italic leading-relaxed text-neutral-700">
      “{text.slice(0, i)}
      <mark className="rounded-sm bg-[#cfe0ff] px-0.5 not-italic text-[#161616]">{text.slice(i, i + value.length)}</mark>
      {text.slice(i + value.length)}”
    </p>
  );
}

// Opens the whole source file a claim was read from.
export function SourceFile({ claimId, file }: { claimId: string; file?: string }) {
  const [text, setText] = useState<string | null>(null);
  if (!file) return null;
  return (
    <div>
      <button
        onClick={async () => {
          if (text !== null) return setText(null);
          const res = await fetch(`/api/trust/source?claim=${encodeURIComponent(claimId)}`);
          setText(res.ok ? (await res.json()).text : "Could not load the file.");
        }}
        className="text-xs font-medium text-neutral-700 hover:text-black"
      >
        {text !== null ? "Hide source file ▴" : `Open ${file.split("/").pop()} ▾`}
      </button>
      {text !== null && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 font-mono text-[10.5px] leading-relaxed text-neutral-700">
          {text}
        </pre>
      )}
    </div>
  );
}
