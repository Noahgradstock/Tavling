"use client";

import { useEffect, useMemo, useState } from "react";
import { customer } from "@/lib/knowledge";
import type { AskResult, Client, FeedbackKind } from "@/trust-engine";
import { cardsOf, useTimeline } from "@/lib/demo-shared";
import Funnel, { funnelLayers, funnelStage, LAYERS } from "./funnel";
import { Result } from "./result";

// Three moments: ask (only the chat) → thinking (the documents get sorted) → the answer and why.

// DEMO ONLY: who is giving feedback. Replace with the signed-in user.
const DEMO_USER = "sofie";
const THINKING_MS = 7_000;

type Ctx = { client?: string; country?: string; pc?: string };
type Example = { question: string; context: Ctx };

// Cases without a client: pick by country and sector.
const GENERAL: { key: string; label: string; ctx: Ctx }[] = [
  { key: "be-200", label: "Belgium · PC 200 (no client)", ctx: { country: "BE", pc: "200" } },
  { key: "be", label: "Belgium (no client)", ctx: { country: "BE" } },
  { key: "nl", label: "Netherlands (no client)", ctx: { country: "NL" } },
];
const DEMO_CASE: Example = { question: customer.question, context: { client: "brouwerij-de-kroon" } };

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [ctx, setCtx] = useState<Ctx>({ client: "brouwerij-de-kroon" });
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(0);
  const [p, skip] = useTimeline(run, THINKING_MS);

  useEffect(() => {
    fetch("/api/trust/meta")
      .then((r) => r.json())
      .then((m) => {
        setClients(m.clients);
        setExamples(m.examples);
      });
  }, []);

  const hit = result?.matched ? result : null;
  const cards = useMemo(() => (hit ? cardsOf(hit) : []), [hit]);
  const phase = loading || (hit && p < 1) ? "thinking" : result ? "done" : "ask";

  const ctxKey = ctx.client ?? GENERAL.find((g) => g.ctx.country === ctx.country && g.ctx.pc === ctx.pc)?.key ?? "be";
  const ctxName = ctx.client ? (clients.find((c) => c.id === ctx.client)?.name ?? ctx.client) : GENERAL.find((g) => g.key === ctxKey)?.label ?? "";
  const setCtxKey = (key: string) => setCtx(GENERAL.find((g) => g.key === key)?.ctx ?? { client: key });

  async function fetchAnswer(q: string, c: Ctx) {
    const res = await fetch("/api/trust/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, context: c }),
    });
    return (await res.json()) as AskResult;
  }

  async function ask(q = question, c = ctx) {
    if (!q.trim() || loading) return;
    setCtx(c);
    setAsked(q);
    setResult(null);
    setLoading(true);
    try {
      setResult(await fetchAnswer(q, c));
      setRun((r) => r + 1);
    } finally {
      setLoading(false);
    }
  }

  async function vote(claimId: string, kind: FeedbackKind) {
    await fetch("/api/trust/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-user": DEMO_USER },
      body: JSON.stringify({ claimId, kind, context: ctx }),
    });
    setResult(await fetchAnswer(asked, ctx));
  }

  function reset() {
    setResult(null);
    setQuestion("");
  }

  const clientOptions = (
    <select value={ctxKey} onChange={(e) => setCtxKey(e.target.value)} className="cursor-pointer bg-transparent font-medium text-neutral-700 outline-none">
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      {GENERAL.map((g) => (
        <option key={g.key} value={g.key}>
          {g.label}
        </option>
      ))}
    </select>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 text-[#161616]">
      {phase === "ask" && (
        <div className="flex flex-1 flex-col justify-center py-16">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">Ask the company brain</h1>
          <p className="mt-3 max-w-lg text-neutral-500">
            One answer from policies, Teams, email and the law, and the reason you can trust it.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="mt-8 rounded-3xl bg-white p-5 shadow-[0_10px_40px_-16px_rgba(0,0,0,0.2)]"
          >
            <textarea
              autoFocus
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
              className="w-full resize-none text-base leading-relaxed outline-none placeholder:text-neutral-400"
              placeholder="Ask a payroll or HR question, in any language…"
            />
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-neutral-400">For</span>
              {clientOptions}
              <button
                disabled={!question.trim()}
                className="ml-auto rounded-full bg-[#161616] px-5 py-2 font-medium text-white transition hover:bg-black disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                Ask
              </button>
            </div>
          </form>

          <div className="mt-10">
            <div className="text-xs text-neutral-400">Example questions from our test data. Click one to try it.</div>
            <div className="mt-3 flex flex-col divide-y divide-neutral-200/70">
              {[DEMO_CASE, ...examples].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => ask(ex.question, ex.context)}
                  className="group flex items-center gap-4 py-2.5 text-left text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-neutral-700 group-hover:text-black">{ex.question}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {ex.context.client
                      ? clients.find((c) => c.id === ex.context.client)?.name
                      : GENERAL.find((g) => g.ctx.country === ex.context.country && g.ctx.pc === ex.context.pc)?.label.replace(" (no client)", "")}
                  </span>
                  <span className="text-neutral-300 group-hover:text-neutral-900">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "thinking" && (
        <div className="flex flex-1 flex-col justify-center gap-8 py-16">
          <div>
            <div className="text-xs text-neutral-400">You asked · {ctxName}</div>
            <div className="mt-0.5 line-clamp-2 text-neutral-700">{asked}</div>
          </div>
          <Thinking p={p} loading={loading} hit={hit} />
          {hit ? (
            <Funnel hit={hit} cards={cards} q={p} onSelect={() => {}} minimal />
          ) : (
            <div className="h-[380px]" />
          )}
          {hit && (
            <button onClick={skip} className="self-center text-xs text-neutral-400 hover:text-neutral-900">
              Skip to the answer →
            </button>
          )}
        </div>
      )}

      {phase === "done" && result && !result.matched && (
        <div className="flex flex-1 flex-col justify-center gap-4 py-16">
          <p className="text-lg">{result.message}</p>
          <p className="text-sm text-neutral-500">Try one of the example questions.</p>
          <button onClick={reset} className="self-start rounded-full bg-[#161616] px-4 py-2 text-sm font-medium text-white">
            New question
          </button>
        </div>
      )}

      {phase === "done" && hit && (
        <div className="py-12">
          <Result
            hit={hit}
            question={asked}
            clientName={ctxName}
            onVote={vote}
            onNew={reset}
            sorting={<Funnel hit={hit} cards={cards} q={1} onSelect={() => {}} minimal />}
          />
        </div>
      )}
    </main>
  );
}

// One plain sentence that says what the brain is doing right now.
function Thinking({ p, loading, hit }: { p: number; loading: boolean; hit: AskResult | null }) {
  const h = hit?.matched ? hit : null;
  const stage = funnelStage(p);
  const layers = funnelLayers(p);
  const layer = LAYERS[Math.max(0, layers - 1)];
  const text =
    loading || !h
      ? "Reading your question…"
      : stage === 0
        ? `Found ${h.claims.length + h.excluded.length} sources that mention this`
        : stage === 1
          ? `Checking every source · ${layer.name}: ${layer.q.toLowerCase()}`
          : stage === 2
            ? `${h.claims.filter((c) => c.score >= 0.75).length} sources pass the trust bar`
            : "Choosing the answer";
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1463ff] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1463ff]" />
      </span>
      <span className="font-serif text-2xl sm:text-3xl">{text}</span>
    </div>
  );
}
