"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { customer } from "@/lib/knowledge";
import type { AskResult, Client, FeedbackKind } from "@/trust-engine";
import { cardsOf, seg, useStepper } from "@/lib/demo-shared";
import Funnel, { funnelLayers, funnelStage, LAYERS } from "./funnel";
import ScanStage, { scannedCount } from "./scan";
import ConnectStage, { connectText } from "./connect";
import { Result } from "./result";

// Three moments: ask (only the chat) → thinking (the documents get sorted) → the answer and why.

const STEP_MS = 7_000; // each step plays slowly on its own…
const PAUSE_MS = 1_500; // …then holds briefly before the next one starts
const CONNECT = 0.16; // first: search the connected systems
const SCAN = 0.42; // then scan the documents, then sort them
// Where each step ends.
const inFunnel = (q: number) => SCAN + (1 - SCAN) * q;
const STOPS = [CONNECT - 0.001, SCAN - 0.001, inFunnel(0.09), inFunnel(0.62), inFunnel(0.8), 0.999, 1];

type Ctx = { client?: string; country?: string; pc?: string };
type Example = { question: string; context: Ctx; label?: string };

// Cases without a client: pick by country and sector.
const GENERAL: { key: string; label: string; ctx: Ctx }[] = [
  { key: "be-200", label: "Belgium · PC 200", ctx: { country: "BE", pc: "200" } },
  { key: "be", label: "Belgium", ctx: { country: "BE" } },
  { key: "nl", label: "Netherlands", ctx: { country: "NL" } },
];
const DEMO_CASE: Example = { question: customer.question, context: { client: "brouwerij-de-kroon" }, label: "Sick leave: do we pay again?" };

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
  const [ctx, setCtx] = useState<Ctx>({ client: "brouwerij-de-kroon" });
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(0);
  const { p, skip } = useStepper(run, STOPS, STEP_MS, PAUSE_MS);

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

  // An example is typed into the chat box first, then sent, as if the user asked it.
  const typing = useRef(false);
  function tryExample(ex: Example) {
    if (typing.current || loading) return;
    typing.current = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const q = ex.question;
    const steps = Math.min(q.length, 40);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setQuestion(q.slice(0, Math.ceil((q.length * i) / steps)));
      if (i < steps) return;
      clearInterval(id);
      setTimeout(() => {
        typing.current = false;
        ask(q, ex.context);
      }, 600);
    }, 25);
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

          <div className="mt-10">
            <div className="text-xs text-neutral-400">Example questions from our test data. Click one to try it.</div>
            <div className="mt-3 flex flex-col divide-y divide-neutral-200/70">
              {[DEMO_CASE, ...examples].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => tryExample(ex)}
                  className="group flex items-center gap-4 py-2.5 text-left text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-neutral-700 group-hover:text-black">{ex.question}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{contextLabel(ex.context)}</span>
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
          <Thinking p={p} loading={loading} hit={hit} n={cards.length} />
          {hit ? (
            p < CONNECT ? (
              <ConnectStage cards={cards} q={seg(p, 0, CONNECT)} />
            ) : p < SCAN ? (
              <ScanStage cards={cards} q={seg(p, CONNECT, SCAN)} />
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
      : p < CONNECT
        ? connectText
        : p < SCAN
        ? `Reading ${n} documents · ${scannedCount(seg(p, CONNECT, SCAN), n)}/${n}`
        : stage === 0
        ? `Found ${h.claims.length + h.excluded.length} sources that mention this`
        : stage === 1
          ? `Checking every source · ${layer.name}: ${layer.q.toLowerCase()}`
          : stage === 2
            ? `${h.claims.filter((c) => c.score >= 0.75).length} sources pass the trust bar`
            : "Choosing the answer";
  // What the scan step does, in one plain sentence.
  const explain =
    h && p >= CONNECT && p < SCAN
      ? "The system finds the documents relevant to your question and scans them for signals it can compare: what each one says, who wrote it, when, and for which country. That is how it judges which sources apply and how well they fit this question. Every step is logged."
      : null;
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1463ff] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1463ff]" />
        </span>
        <span className="font-serif text-2xl sm:text-3xl">{text}</span>
      </div>
      {explain && <p className="mt-2 max-w-2xl pl-[22px] text-sm leading-relaxed text-neutral-500">{explain}</p>}
    </div>
  );
}
