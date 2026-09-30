"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { customer, sources } from "@/lib/knowledge";
import { fallbackAnswer } from "@/lib/fallback-answer";
import { scoreSource } from "@/lib/trust";

// The scroll story replays the brain's reasoning with the cached, verified answer so it never breaks.
const trust = Object.fromEntries(
  sources.map((s) => [s.id, scoreSource(s, fallbackAnswer.readings.find((r) => r.id === s.id))]),
);
const byId = (id: string) => sources.find((s) => s.id === id)!;

const KEPT = ["policy-2026", "manual-2023", "teams-tom"];
const DROPPED: Record<string, string> = {
  "nl-guide": "Other country",
  "draft-email": "Draft, never published",
  "faq-solidarity": "Only covers part 2 · kept for later",
};

function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

export default function Story() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-28 px-4 pb-32 pt-16">
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">How the brain decided</div>
        <h2 className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight">
          From a question
          <br />
          to an answer you can trust
        </h2>
      </div>
      <StepQuestion />
      <StepSearch />
      <StepNarrow />
      <StepCheck />
      <StepVerdict />
    </div>
  );
}

function Step({
  n,
  label,
  title,
  text,
  children,
}: {
  n: string;
  label: string;
  title: string;
  text: string;
  children: (seen: boolean) => ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className="flex flex-col gap-6">
      <div className={`transition duration-700 ${seen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1463ff]" />
          {n} · {label}
        </div>
        <h3 className="mt-2 font-serif text-4xl leading-tight tracking-tight">{title}</h3>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-neutral-600">{text}</p>
      </div>
      {children(seen)}
    </section>
  );
}

/* 01 — the question is typed into the brain over a field of documents */
function StepQuestion() {
  return (
    <Step
      n="01"
      label="The question"
      title="An urgent customer question"
      text={`${customer.contact} at ${customer.company} needs an answer today. Getting it wrong means paying 30 days of salary that isn't owed.`}
    >
      {(seen) => (
        <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-[#e8e4dc] py-14">
          <Barcode count={64} />
          <div className="relative mx-4 rounded-2xl bg-white p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] sm:mx-10">
            <Typewriter text={customer.question} run={seen} />
            <div className="mt-3 flex justify-end">
              <span className="rounded-full bg-[#161616] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                Ask
              </span>
            </div>
          </div>
        </div>
      )}
    </Step>
  );
}

function Typewriter({ text, run }: { text: string; run: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setN((x) => (x >= text.length ? x : x + 2)), 18);
    return () => clearInterval(t);
  }, [run, text]);
  return (
    <p className="min-h-[4.5rem] text-[15px] leading-relaxed">
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#1463ff]" />
    </p>
  );
}

function Barcode({ count, tone = "dark" }: { count: number; tone?: "dark" | "blue" }) {
  return (
    <div className="absolute inset-0 flex items-stretch justify-between px-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="barcode-bar"
          style={{
            width: 1 + ((i * 7) % 4),
            background: tone === "blue" ? "#1463ff" : "#161616",
            animationDelay: `${(i % 16) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

/* 02 — the brain fans out to every knowledge channel */
function StepSearch() {
  return (
    <Step
      n="02"
      label="Search"
      title="It searches everywhere knowledge lives"
      text="Policies, old PDF manuals, Confluence pages in other countries, Teams chats, newsletters and email. Six sources mention the question."
    >
      {(seen) => (
        <div className="relative rounded-2xl border border-black/5 bg-[#e8e4dc] p-5">
          <div className="flex justify-center">
            <BrainNode active={seen} />
          </div>
          <svg className="mx-auto block h-10 w-full" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden>
            {[50, 150, 250, 350, 450, 550].map((x, i) => (
              <path
                key={x}
                d={`M300 0 C300 25 ${x} 15 ${x} 40`}
                fill="none"
                stroke="#9a958c"
                strokeWidth="1.2"
                strokeDasharray="3 4"
                style={{ opacity: seen ? 1 : 0, transition: `opacity .4s ${0.3 + i * 0.12}s` }}
              />
            ))}
          </svg>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {sources.map((s, i) => (
              <div
                key={s.id}
                className="rounded-xl border border-black/5 bg-[#f7f5f1] p-3 transition duration-500"
                style={{
                  opacity: seen ? 1 : 0,
                  transform: seen ? "none" : "translateY(12px)",
                  transitionDelay: `${0.5 + i * 0.12}s`,
                }}
              >
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  {s.channel}
                  <span className="text-[#1463ff]">found</span>
                </div>
                <div className="relative my-2.5 h-7 overflow-hidden rounded bg-white">
                  <Barcode count={26} />
                </div>
                <div className="truncate text-[13px] font-medium">{s.short}</div>
                <div className="text-[11px] text-neutral-500">
                  {s.country} · {s.date.slice(0, 7)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Step>
  );
}

function BrainNode({ active }: { active: boolean }) {
  return (
    <div className="relative">
      {active && <span className="absolute inset-0 animate-ping rounded-2xl bg-[#1463ff]/25" />}
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#161616] text-white">
        <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="14" cy="14" r="6" />
          <circle cx="26" cy="14" r="6" />
          <circle cx="14" cy="26" r="6" />
          <circle cx="26" cy="26" r="6" />
        </svg>
      </div>
    </div>
  );
}

/* 03 — sources that don't apply fall away, three remain for the hard part */
function StepNarrow() {
  return (
    <Step
      n="03"
      label="Narrow down"
      title="Six sources become three"
      text="A Dutch guide doesn't apply in Belgium. A draft was never published. Three sources remain that disagree on the hard part of the question: the relapse rule."
    >
      {(seen) => (
        <div className="flex flex-col gap-2">
          {sources.map((s, i) => {
            const dropped = DROPPED[s.id];
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-black/5 px-4 py-3 transition-all duration-700"
                style={{
                  background: seen && dropped ? "transparent" : "#fff",
                  opacity: seen && dropped ? 0.45 : 1,
                  transform: seen && dropped ? "translateX(24px) scale(0.97)" : "none",
                  transitionDelay: `${0.3 + i * 0.15}s`,
                }}
              >
                <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  {s.channel}
                </span>
                <span className={`flex-1 text-sm ${seen && dropped ? "line-through" : "font-medium"}`}>{s.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] transition-opacity duration-500 ${
                    dropped ? "bg-neutral-200 text-neutral-600" : "bg-[#e8efff] text-[#1463ff]"
                  }`}
                  style={{ opacity: seen ? 1 : 0, transitionDelay: `${0.6 + i * 0.15}s` }}
                >
                  {dropped ?? "Answers the relapse rule"}
                </span>
              </div>
            );
          })}
          <div
            className="mt-2 text-center font-serif text-3xl transition-opacity duration-700"
            style={{ opacity: seen ? 1 : 0, transitionDelay: "1.5s" }}
          >
            6 → 3
          </div>
        </div>
      )}
    </Step>
  );
}

/* 04 — each remaining source is checked against the six trust signals */
function StepCheck() {
  const signals = trust[KEPT[0]].signals.map((s) => s.key);
  return (
    <Step
      n="04"
      label="Check"
      title="Every source is checked, in the open"
      text="Right country, consistent with the rest, verified by an expert, recent, owned by someone still here, and final. No black box: each signal adds points you can see."
    >
      {(seen) => (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
          <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] border-b border-black/5 bg-[#f7f5f1] text-[12px] font-medium">
            <div className="p-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">Signal</div>
            {KEPT.map((id) => (
              <div key={id} className="p-3 text-center">
                {byId(id).short}
              </div>
            ))}
          </div>
          {signals.map((key, row) => (
            <div key={key} className="grid grid-cols-[1.2fr_repeat(3,1fr)] border-b border-black/5 text-sm last:border-0">
              <div className="p-3 capitalize text-neutral-600">{key === "fresh" ? "recent" : key}</div>
              {KEPT.map((id, col) => {
                const sig = trust[id].signals.find((s) => s.key === key)!;
                return (
                  <div key={id} className="flex items-center justify-center p-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition duration-300 ${
                        sig.ok ? "bg-[#e8efff] text-[#1463ff]" : "bg-[#ffe9ea] text-[#c62a30]"
                      }`}
                      style={{
                        opacity: seen ? 1 : 0,
                        transform: seen ? "scale(1)" : "scale(0.4)",
                        transitionDelay: `${0.4 + row * 0.25 + col * 0.08}s`,
                      }}
                      title={sig.detail}
                    >
                      {sig.ok ? "✓" : "✕"}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] bg-[#f7f5f1]">
            <div className="p-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">Trust</div>
            {KEPT.map((id) => (
              <div key={id} className="flex items-center justify-center p-3">
                <CountUp to={trust[id].score} run={seen} delay={2000} level={trust[id].level} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Step>
  );
}

const LEVEL_COLOR = { trusted: "#1463ff", care: "#e39a0b", avoid: "#e5484d" } as const;

function CountUp({ to, run, delay, level }: { to: number; run: boolean; delay: number; level: keyof typeof LEVEL_COLOR }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 900));
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, delay]);
  return (
    <span className="font-serif text-3xl tabular-nums" style={{ color: v === to && run ? LEVEL_COLOR[level] : "#161616" }}>
      {v}
    </span>
  );
}

/* 05 — the conflict is resolved and the answer shows why it can be trusted */
function StepVerdict() {
  const answer = fallbackAnswer;
  return (
    <Step
      n="05"
      label="Verdict"
      title="The conflict, resolved"
      text="The verified 2026 policy outranks an ownerless 2023 manual and a Teams message. The consultant sees the answer, the reason and who to ask."
    >
      {(seen) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Claim
              seen={seen}
              delay={0.2}
              value="8 weeks"
              who="BE policy 2026"
              score={trust["policy-2026"].score}
              win
            />
            <Claim
              seen={seen}
              delay={0.4}
              value="14 days"
              who="Manual v4 · Teams message"
              score={Math.max(trust["manual-2023"].score, trust["teams-tom"].score)}
            />
          </div>
          <div
            className="rounded-2xl bg-[#161616] p-5 text-white transition duration-700"
            style={{ opacity: seen ? 1 : 0, transform: seen ? "none" : "translateY(16px)", transitionDelay: "1.2s" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">Answer to the customer</div>
            <p className="mt-2 font-serif text-2xl leading-snug">{answer.headline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span className="rounded-full bg-white/10 px-2.5 py-1">Source: BE policy 2026 · 95</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">Confirm with {answer.askExpert}</span>
              <span className="rounded-full bg-[#e5484d]/20 px-2.5 py-1 text-[#ff9a9d]">Manual v4 flagged as outdated</span>
            </div>
          </div>
        </div>
      )}
    </Step>
  );
}

function Claim({
  seen,
  delay,
  value,
  who,
  score,
  win,
}: {
  seen: boolean;
  delay: number;
  value: string;
  who: string;
  score: number;
  win?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-700 ${
        win ? "border-[#1463ff]/30 bg-white" : "border-black/5 bg-white"
      }`}
      style={{
        opacity: seen ? (win ? 1 : 0.55) : 0,
        transform: seen ? (win ? "scale(1.02)" : "scale(0.97)") : "translateY(12px)",
        transitionDelay: `${delay + (win ? 0.6 : 0.8)}s`,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Relapse period</div>
      <div className={`mt-1 font-serif text-4xl ${win ? "" : "line-through decoration-[#e5484d] decoration-2"}`}>
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{who}</span>
        <span className="font-medium" style={{ color: win ? "#1463ff" : "#e5484d" }}>
          {score}
        </span>
      </div>
    </div>
  );
}
