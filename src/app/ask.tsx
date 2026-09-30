"use client";

import { useEffect, useMemo, useState } from "react";
import { customer } from "@/lib/knowledge";
import type { AskResult, Client, FeedbackKind } from "@/trust-engine";
import { cardsOf, seg, useTimeline } from "@/lib/demo-shared";
import SearchStage, { ScanChips } from "./demo";
import Funnel, { funnelStage } from "./funnel";
import { AnswerCard, ClaimPanel } from "./answer";

// DEMO ONLY: who is giving feedback. Replace with the signed-in user.
const DEMO_USER = "sofie";
const DURATION = 10_000;
const SPLIT = 0.45; // first part: search + scan, second part: trust funnel

const SUGGESTIONS = [
  { label: "Sick leave relapse", q: customer.question },
  { label: "Indexation 2026", q: "What is the wage indexation in January 2026?" },
  { label: "Meal vouchers", q: "What is the max employer part of a meal voucher?" },
  { label: "Overtime", q: "How long do employees have to take overtime recovery rest?" },
  { label: "End-of-year bonus", q: "When do we pay the end-of-year bonus?" },
  { label: "Holiday pay", q: "How much holiday pay do we owe?" },
];
const STEPS = ["Ask", "Search", "Documents", "Criteria", "Score", "Decide"];

export default function Ask() {
  const [question, setQuestion] = useState(customer.question);
  const [clients, setClients] = useState<Client[]>([]);
  const [client, setClient] = useState("brouwerij-de-kroon");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [p, skip] = useTimeline(run, DURATION);

  useEffect(() => {
    fetch("/api/trust/meta").then((r) => r.json()).then((m) => setClients(m.clients));
  }, []);

  const hit = result?.matched ? result : null;
  const cards = useMemo(() => (hit ? cardsOf(hit) : []), [hit]);
  const done = !!hit && p >= 1;
  const qFunnel = seg(p, SPLIT, 1);
  const step = !hit ? (loading ? 1 : 0) : p < SPLIT * 0.55 ? 1 : p < SPLIT ? 2 : [3, 4, 5, 5][funnelStage(qFunnel)];

  async function fetchAnswer(q: string, c: string) {
    const res = await fetch("/api/trust/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, context: { client: c } }),
    });
    return (await res.json()) as AskResult;
  }

  async function ask(q = question, c = client) {
    if (!q.trim() || loading) return;
    setQuestion(q);
    setSelected(null);
    setResult(null);
    setLoading(true);
    try {
      setResult(await fetchAnswer(q, c));
      setRun((r) => r + 1);
    } finally {
      setLoading(false);
    }
  }

  // Feedback updates the scores in place, without replaying the animation.
  async function vote(claimId: string, kind: FeedbackKind) {
    await fetch("/api/trust/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-user": DEMO_USER },
      body: JSON.stringify({ claimId, kind, context: { client } }),
    });
    setResult(await fetchAnswer(question, client));
  }

  const c = clients.find((x) => x.id === client);
  const selectedClaim = hit?.claims.find((x) => x.claim.id === selected) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-10 text-[#161616]">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em]">
        {STEPS.map((l, i) => (
          <span key={l} className={`flex items-center gap-1.5 transition-colors ${i === step ? "text-[#161616]" : "text-neutral-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${i <= step ? "bg-[#1463ff]" : "bg-neutral-300"}`} />
            0{i + 1} {l}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#e9e8e6] to-[#dddcd9] p-4 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="mx-auto max-w-2xl rounded-2xl bg-white p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]"
        >
          {hit && p < SPLIT && <ScanChips cards={cards} q={seg(p, 0, SPLIT)} />}
          <div className="mb-1 flex items-center gap-2 text-[10px] text-neutral-400">
            <span className="shrink-0 rounded-full bg-[#fff4dc] px-1.5 py-0.5 font-medium text-[#9a6400]">Customer question</span>
            <select
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                if (result) ask(question, e.target.value);
              }}
              className="min-w-0 cursor-pointer truncate bg-transparent font-medium text-neutral-600 outline-none"
              aria-label="Client"
            >
              {clients.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            {c && (
              <span className="ml-auto shrink-0 font-mono uppercase tracking-widest">
                {c.country}
                {c.pc && ` · PC ${c.pc}`}
              </span>
            )}
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            rows={3}
            maxLength={500}
            className="w-full resize-none text-[13px] leading-relaxed outline-none placeholder:text-neutral-400"
            placeholder="Ask anything about payroll, HR or working time, in any language…"
          />
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => ask(s.q)}
                  className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-900"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              disabled={loading}
              aria-label="Ask"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161616] text-xs text-white transition hover:bg-black disabled:bg-neutral-300"
            >
              ↑
            </button>
          </div>
        </form>

        <div className="mt-4">
          {!hit || p < SPLIT ? (
            <div className="mx-auto max-w-2xl">
              <SearchStage cards={cards} q={seg(p, 0, SPLIT)} loading={loading} />
            </div>
          ) : (
            <Funnel hit={hit} cards={cards} q={qFunnel} onSelect={setSelected} />
          )}
        </div>

        {hit && p < 1 && (
          <button onClick={skip} className="absolute bottom-3 right-4 text-[11px] text-neutral-500 hover:text-neutral-900">
            Skip to answer →
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {result && !result.matched && (
          <div className="rounded-2xl bg-white p-4 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {result.message} Try one of the suggestions above.
          </div>
        )}
        {done &&
          hit &&
          (selectedClaim ? (
            <ClaimPanel c={selectedClaim} people={hit.people} onVote={vote} onClose={() => setSelected(null)} />
          ) : (
            <AnswerCard hit={hit} onVote={vote} onSelect={setSelected} />
          ))}
        {!result && !loading && (
          <p className="text-center text-xs text-neutral-500">
            Ask a question. The brain finds every source that mentions it, sets aside what doesn&apos;t apply to this client, scores the rest
            in six open layers, and tells you which one to trust.
          </p>
        )}
      </div>
    </main>
  );
}
