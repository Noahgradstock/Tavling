"use client";

import { useEffect, useState } from "react";
import type { AskResult, Client, FactStatus, FeedbackKind, ScoredClaim } from "@/trust-engine";

// Minimal chat to try the trust engine. The real UI lives in brain.tsx.

type Meta = { people: { id: string; name: string; role: string }[]; clients: Client[] };
type Message = { role: "user"; text: string } | { role: "brain"; question: string; result: AskResult };

const STATUS: Record<FactStatus, { label: string; cls: string }> = {
  trusted: { label: "Trusted", cls: "bg-[#e8efff] text-[#1463ff]" },
  conflict: { label: "Conflict", cls: "bg-[#ffe9ea] text-[#c62a30]" },
  stale: { label: "Getting stale", cls: "bg-[#fff4dc] text-[#9a6400]" },
  orphan: { label: "No expert behind it", cls: "bg-neutral-100 text-neutral-600" },
};

const VOTES: { kind: FeedbackKind; label: string }[] = [
  { kind: "correct", label: "✅ Correct" },
  { kind: "wrong", label: "❌ Wrong" },
  { kind: "outdated", label: "🕒 Outdated" },
  { kind: "not_applicable", label: "🎯 Not my case" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;
const barColor = (n: number) => (n >= 0.75 ? "bg-[#1463ff]" : n >= 0.5 ? "bg-[#e39a0b]" : "bg-[#e5484d]");

export default function Chat() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [user, setUser] = useState("anna");
  const [client, setClient] = useState("");
  const [country, setCountry] = useState("BE");
  const [pc, setPc] = useState("200");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/trust/meta").then((r) => r.json()).then(setMeta);
  }, []);

  const context = client ? { client } : { country, pc };

  async function query(question: string) {
    const res = await fetch("/api/trust/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, context }),
    });
    return (await res.json()) as AskResult;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: question }]);
    const result = await query(question);
    setMessages((m) => [...m, { role: "brain", question, result }]);
    setBusy(false);
  }

  // Vote, then re-run the question so the new score shows up in place.
  async function vote(index: number, question: string, claimId: string, kind: FeedbackKind) {
    await fetch("/api/trust/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-user": user },
      body: JSON.stringify({ claimId, kind, context }),
    });
    const result = await query(question);
    setMessages((m) => m.map((msg, i) => (i === index ? { role: "brain", question, result } : msg)));
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4 py-4">
      <header className="flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
        <h1 className="mr-auto text-lg font-semibold">Company brain · trust chat</h1>
        <label>
          You are{" "}
          <select className="rounded border px-1" value={user} onChange={(e) => setUser(e.target.value)}>
            {meta?.people.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
          </select>
        </label>
        <select className="rounded border px-1" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">No client</option>
          {meta?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!client && (
          <>
            <select className="rounded border px-1" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option>BE</option>
              <option>NL</option>
            </select>
            <input className="w-16 rounded border px-1" placeholder="PC" value={pc} onChange={(e) => setPc(e.target.value)} />
          </>
        )}
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Try: &quot;What is the indexation?&quot;, &quot;Meal voucher max?&quot;, &quot;Relapse after sick leave?&quot;,
            &quot;Overtime recovery?&quot;, &quot;When is the end-of-year bonus paid?&quot;. Switch client or country to see scope change the answer.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[80%] rounded-2xl bg-[#1463ff] px-3 py-2 text-white">{m.text}</div>
          ) : (
            <BrainReply key={i} result={m.result} onVote={(id, kind) => vote(i, m.question, id, kind)} />
          ),
        )}
        {busy && <p className="text-sm text-neutral-500">Thinking…</p>}
      </section>

      <form onSubmit={send} className="flex gap-2 border-t pt-3">
        <input
          className="flex-1 rounded-lg border px-3 py-2"
          placeholder="Ask the brain…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="rounded-lg bg-[#1463ff] px-4 py-2 text-white disabled:opacity-50" disabled={busy}>Ask</button>
      </form>
    </main>
  );
}

function BrainReply({ result, onVote }: { result: AskResult; onVote: (claimId: string, kind: FeedbackKind) => void }) {
  if (!result.matched) {
    return (
      <div className="max-w-[90%] rounded-2xl bg-neutral-100 px-3 py-2 text-sm">
        {result.message} I know about: {result.suggestions.join(" · ")}
      </div>
    );
  }
  const status = STATUS[result.status];
  return (
    <div className="max-w-[90%] space-y-2 rounded-2xl bg-neutral-100 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
        <span className="font-medium">{result.answer}</span>
      </div>
      {result.warnings.map((w) => <p key={w} className="text-[#9a6400]">⚠️ {w}</p>)}
      <details open>
        <summary className="cursor-pointer text-neutral-600">Trust receipt · {result.claims.length} sources apply</summary>
        <ul className="mt-2 space-y-2">
          {result.claims.map((c) => <ClaimRow key={c.claim.id} c={c} onVote={onVote} />)}
        </ul>
      </details>
      {result.excluded.length > 0 && (
        <details>
          <summary className="cursor-pointer text-neutral-500">{result.excluded.length} sources don&apos;t apply to this case</summary>
          <ul className="mt-1 list-disc pl-5 text-neutral-500">
            {result.excluded.map((e) => <li key={e.claim.id}>{e.claim.source.title}: {e.claim.value}. {e.reason}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function ClaimRow({ c, onVote }: { c: ScoredClaim; onVote: (claimId: string, kind: FeedbackKind) => void }) {
  return (
    <li className="rounded-lg bg-white p-2">
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 overflow-hidden rounded bg-neutral-200">
          <div className={`h-full ${barColor(c.score)}`} style={{ width: pct(c.score) }} />
        </div>
        <span className="w-10 font-mono text-xs">{pct(c.score)}</span>
        <span className="font-medium">{c.claim.value}</span>
        <span className="text-neutral-500">· {c.claim.source.title} · {c.claim.date}</span>
      </div>
      <p className="mt-1 italic text-neutral-600">&ldquo;{c.claim.text}&rdquo;</p>
      <ul className="mt-1 text-xs text-neutral-600">
        {c.evidence.map((e) => (
          <li key={e.layer + e.label}>
            <span className={`inline-block w-12 font-mono ${e.points >= 0 ? "text-[#1463ff]" : "text-[#c62a30]"}`}>
              {e.points > 0 ? "+" : ""}{e.points}
            </span>
            {e.label}
          </li>
        ))}
        {c.caps.map((cap) => <li key={cap} className="text-[#c62a30]">⛔ {cap}</li>)}
      </ul>
      <div className="mt-1 flex flex-wrap gap-1">
        {VOTES.map((v) => (
          <button key={v.kind} onClick={() => onVote(c.claim.id, v.kind)} className="rounded border px-1.5 text-xs hover:bg-neutral-100">
            {v.label}
          </button>
        ))}
      </div>
    </li>
  );
}
