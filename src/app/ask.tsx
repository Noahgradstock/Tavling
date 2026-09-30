"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { customer } from "@/lib/knowledge";
import type { AskResult, Client, FeedbackKind } from "@/trust-engine";
import { cardsOf, seg, useTimeline } from "@/lib/demo-shared";
import Funnel, { funnelLayers, funnelStage, LAYERS } from "./funnel";
import ScanStage, { scannedCount } from "./scan";
import { Result } from "./result";

// Three moments: ask (only the chat) → thinking (the documents get sorted) → the answer and why.

const THINKING_MS = 10_000;
const SCAN = 0.35; // first part of thinking: scan the documents, then sort them

type Ctx = { client?: string; country?: string; pc?: string };
type Example = { question: string; context: Ctx; label?: string };

// Cases without a client: pick by country and sector.
const GENERAL: { key: string; label: string; ctx: Ctx }[] = [
  { key: "be-200", label: "Belgium · PC 200", ctx: { country: "BE", pc: "200" } },
  { key: "be", label: "Belgium", ctx: { country: "BE" } },
  { key: "nl", label: "Netherlands", ctx: { country: "NL" } },
];
const DEMO_CASE: Example = { question: customer.question, context: { client: "brouwerij-de-kroon" }, label: "Sick leave: do we pay again?" };

// A handful of examples that show different outcomes: official rule, client exception, other country, disagreement.
const FEATURED: Example[] = [
  DEMO_CASE,
  { label: "Indexation for Bakkerij Janssens", question: "What is the indexation for Bakkerij Janssens?", context: { client: "bakkerij-janssens" } },
  { label: "Company car minimum benefit 2026", question: "What is the minimum benefit in kind for a company car in 2026?", context: { country: "BE" } },
  { label: "TechStart's telework allowance", question: "What telework allowance does TechStart pay?", context: { client: "techstart-gent" } },
  { label: "Maternity leave in the Netherlands", question: "How long is maternity leave in the Netherlands?", context: { country: "NL" } },
  { label: "Cut-off for variable pay", question: "What is the cut-off for variable pay input?", context: { country: "BE" } },
];

// No case is open in the demo, so the client, country and sector are read from the question itself.
// In production they come from the consultant's open case.
function inferContext(q: string, clients: Client[]): Ctx {
  const text = q.toLowerCase();
  const client = clients.find((c) =>
    c.name
      .toLowerCase()
      .replace(/\b(nv|bv|bvba)\b/g, "")
      .split(/\s+/)
      .some((w) => w.length > 4 && w !== "brouwerij" && w !== "bakkerij" && text.includes(w)),
  );
  if (client) return { client: client.id };
  const country = /\b(netherlands|nederland|dutch|holland|nl)\b/.test(text) ? "NL" : "BE";
  const pc = text.match(/\bpc\s?(\d{3})\b/)?.[1];
  return pc && country === "BE" ? { country, pc } : { country };
}

export default function Ask() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [showAll, setShowAll] = useState(false);
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
        // Start on a client this user works on.
        setCtx((c) =>
          c.client && !m.clients.some((x: Client) => x.id === c.client)
            ? m.clients[0] ? { client: m.clients[0].id } : { country: m.countries?.[0] }
            : c,
        );
      });
  }, []);

  const hit = result?.matched ? result : null;
  const cards = useMemo(() => (hit ? cardsOf(hit) : []), [hit]);
  const phase = loading || (hit && p < 1) ? "thinking" : result ? "done" : "ask";

  const ctxKey = ctx.client ?? GENERAL.find((g) => g.ctx.country === ctx.country && g.ctx.pc === ctx.pc)?.key ?? "be";
  const ctxName = ctx.client ? (clients.find((c) => c.id === ctx.client)?.name ?? ctx.client) : GENERAL.find((g) => g.key === ctxKey)?.label ?? "";

  const contextLabel = (c: Ctx) =>
    c.client ? (clients.find((x) => x.id === c.client)?.name ?? "") : (GENERAL.find((g) => g.ctx.country === c.country && g.ctx.pc === c.pc)?.label ?? c.country ?? "");

  async function fetchAnswer(q: string, c: Ctx) {
    const res = await fetch("/api/trust/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, context: c }),
    });
    if (res.status === 401) router.replace("/login");
    // No access to that client or country (403), or too many questions (429): show the reason instead of an answer.
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      return { matched: false, message: err?.error ?? "Something went wrong, try again.", suggestions: [] } as AskResult;
    }
    return (await res.json()) as AskResult;
  }

  async function ask(q = question, explicit?: Ctx) {
    const c = explicit ?? inferContext(q, clients);
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

  // The voter is the signed-in user: the server reads it from the session cookie.
  async function vote(claimId: string, kind: FeedbackKind) {
    const res = await fetch("/api/trust/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimId, kind, context: ctx }),
    });
    if (res.status === 401) return router.replace("/login");
    setResult(await fetchAnswer(asked, ctx));
  }

  function reset() {
    setResult(null);
    setQuestion("");
  }


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
<span className="text-xs text-neutral-400">Mention a client or country if it matters, e.g. “for Bakkerij Janssens”.</span>
              <button
                disabled={!question.trim()}
                className="ml-auto rounded-full bg-[#161616] px-5 py-2 font-medium text-white transition hover:bg-black disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                Ask
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="text-sm text-neutral-500">Try an example</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(showAll ? [DEMO_CASE, ...examples] : FEATURED).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => ask(ex.question, ex.context)}
                  className="rounded-full border border-neutral-200 bg-white/60 px-3.5 py-1.5 text-left text-sm text-neutral-700 transition hover:border-neutral-400 hover:bg-white hover:text-black"
                >
                  {ex.label ?? ex.question}
                  <span className="ml-2 text-xs text-neutral-400">{contextLabel(ex.context)}</span>
                </button>
              ))}
            </div>
            {examples.length > 0 && (
              <button onClick={() => setShowAll(!showAll)} className="mt-3 text-xs text-neutral-400 hover:text-neutral-800">
                {showAll ? "Fewer examples" : `All ${examples.length + 1} test questions →`}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "thinking" && (
        <div className="flex flex-1 flex-col justify-center gap-8 py-16">
          <div>
            <div className="text-xs text-neutral-400">You asked · {ctxName}</div>
            <div className="mt-0.5 line-clamp-2 text-neutral-700">{asked}</div>
          </div>
          <Thinking p={p} loading={loading} hit={hit} n={cards.length} />
          {hit ? (
            p < SCAN ? (
              <ScanStage cards={cards} q={seg(p, 0, SCAN)} />
            ) : (
              <Funnel hit={hit} cards={cards} q={seg(p, SCAN, 1)} onSelect={() => {}} minimal />
            )
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
function Thinking({ p, loading, hit, n }: { p: number; loading: boolean; hit: AskResult | null; n: number }) {
  const h = hit?.matched ? hit : null;
  const q = seg(p, SCAN, 1);
  const stage = funnelStage(q);
  const layers = funnelLayers(q);
  const layer = LAYERS[Math.max(0, layers - 1)];
  const text =
    loading || !h
      ? "Reading your question…"
      : p < SCAN
        ? `Scanning ${n} documents · ${scannedCount(seg(p, 0, SCAN), n)} done`
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
