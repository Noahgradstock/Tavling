"use client";

import { useState } from "react";
import {
  client,
  maskSource,
  people,
  sourceSignals,
  sources,
  trustFor,
  type Brief,
  type Fact,
  type Source,
  type Trust,
} from "@/lib/knowledge";

const byId = Object.fromEntries(sources.map((s) => [s.id, s])) as Record<string, Source>;

const channelLabel: Record<Source["channel"], string> = {
  confluence: "Confluence",
  teams: "Teams",
  email: "Email",
  word: "Word",
  pdf: "PDF",
  memo: "Legal memo",
};

const trustStyle: Record<Trust | "resolved", { label: string; dot: string; ring: string }> = {
  verified: { label: "Verified", dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50/40" },
  resolved: { label: "Verified by you", dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50/40" },
  check: { label: "Check before use", dot: "bg-amber-400", ring: "border-amber-200 bg-amber-50/40" },
  conflict: { label: "Sources disagree", dot: "bg-rose-500", ring: "border-rose-200 bg-rose-50/40" },
};

const order: Record<Trust, number> = { conflict: 0, check: 1, verified: 2 };

export default function Handover() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [mode, setMode] = useState<"live" | "cached" | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [highlight, setHighlight] = useState<string[]>([]);
  const [aiView, setAiView] = useState(false);

  async function generate() {
    setLoading(true);
    setResolved({});
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      const data = await res.json();
      setBrief(data.brief);
      setMode(data.mode);
    } finally {
      setLoading(false);
    }
  }

  const facts = (brief?.facts ?? [])
    .map((f) => ({ f, trust: trustFor(byId[f.recommendedSourceId], f.conflict) }))
    .sort((a, b) => order[a.trust] - order[b.trust]);

  const open = facts.filter(({ f, trust }) => trust !== "verified" && !resolved[f.topic]).length;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Client handover</p>
          <h2 className="mt-1 text-lg font-semibold">{client.name}</h2>
          <p className="text-sm text-zinc-600">
            {client.jointCommittee} · Belgium
            <br />
            From {client.previousConsultant} → {client.newConsultant}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700">{sources.length} sources found</h3>
          <button
            onClick={() => setAiView((v) => !v)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            {aiView ? "Show original" : "What the AI sees"}
          </button>
        </div>

        <ul className="space-y-2">
          {sources.map((s) => {
            const lit = highlight.includes(s.id);
            return (
              <li
                key={s.id}
                className={`rounded-lg border bg-white p-3 text-sm transition ${
                  lit ? "border-indigo-400 ring-2 ring-indigo-200" : "border-zinc-200"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    <span className="mr-1 text-xs text-zinc-400">{s.id}</span>
                    {s.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">{channelLabel[s.channel]}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {s.date} · {s.owner ?? "no owner"}
                  {s.ownerStatus === "left" ? " (left)" : ""} · {s.country}
                </p>
                <p className={`mt-2 text-zinc-700 ${aiView ? "font-mono text-xs" : ""}`}>
                  {aiView ? maskSource(s) : s.text}
                </p>
              </li>
            );
          })}
        </ul>
        {aiView && (
          <p className="text-xs text-zinc-500">
            Names and email addresses of client contacts are masked before anything is sent to the AI.
          </p>
        )}
      </aside>

      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Handover brief</h1>
            <p className="text-sm text-zinc-600">
              Every fact shows where it comes from, and why you can or can&apos;t rely on it.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Reading sources…" : brief ? "Regenerate" : "Generate brief"}
          </button>
        </div>

        {!brief && !loading && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
            {client.previousConsultant}&apos;s knowledge of this client is spread over {sources.length} documents, chats and
            emails. Generate a brief to see what you can trust.
          </div>
        )}

        {brief && (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-800">{brief.summary}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {open === 0 ? "All facts checked." : `${open} item${open === 1 ? "" : "s"} need your attention.`}
                {mode === "cached" && " · Showing cached brief (AI unavailable)."}
              </p>
            </div>

            {facts.map(({ f, trust }) => (
              <FactCard
                key={f.topic}
                fact={f}
                trust={resolved[f.topic] ? "resolved" : trust}
                onHover={setHighlight}
                onResolve={() => setResolved((r) => ({ ...r, [f.topic]: true }))}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function FactCard({
  fact,
  trust,
  onHover,
  onResolve,
}: {
  fact: Fact;
  trust: Trust | "resolved";
  onHover: (ids: string[]) => void;
  onResolve: () => void;
}) {
  const style = trustStyle[trust];
  const rec = byId[fact.recommendedSourceId];
  const signals = rec ? sourceSignals(rec) : [];

  return (
    <article
      className={`rounded-xl border p-4 ${style.ring}`}
      onMouseEnter={() => onHover(fact.sourceIds)}
      onMouseLeave={() => onHover([])}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{fact.topic}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>

      <p className="mt-2 text-base font-medium text-zinc-900">{fact.statement}</p>

      {fact.conflict && trust !== "resolved" && (
        <p className="mt-2 rounded-md bg-rose-100/70 px-3 py-2 text-sm text-rose-900">{fact.conflictSummary}</p>
      )}

      <p className="mt-2 text-sm text-zinc-700">
        <span className="font-medium">Why this source: </span>
        {fact.why}
      </p>

      {rec && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <li
              key={s.label}
              className={`rounded-full px-2 py-0.5 text-xs ${
                s.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
              }`}
            >
              {s.ok ? "✓" : "!"} {s.label}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-sm text-zinc-600">
        <span className="font-medium">Payroll impact: </span>
        {fact.impact}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 pt-3 text-sm">
        <span className="text-zinc-600">
          Sources: {fact.sourceIds.join(", ")} · Ask{" "}
          <span className="font-medium text-zinc-800">{fact.askPerson}</span>
          {people[fact.askPerson] ? ` (${people[fact.askPerson]})` : ""}
        </span>
        {trust === "resolved" ? (
          <span className="text-xs text-emerald-700">Shared with the De Kroon team as verified</span>
        ) : trust !== "verified" ? (
          <button
            onClick={onResolve}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-100"
          >
            Confirmed with {fact.askPerson}
          </button>
        ) : null}
      </div>
    </article>
  );
}
