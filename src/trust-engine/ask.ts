import { evaluateFact, sameValue } from "./score";
import type { Context, Fact, FactResult, Feedback, KnowledgeBase, Person } from "./types";

export type AskResult =
  | { matched: false; message: string; suggestions: string[] }
  | ({
      matched: true;
      answer: string;
      warnings: string[];
      people: Record<string, Person>; // authors of the claims in this result
      expert: Person | null; // who to ask to confirm
    } & FactResult);

// Simple keyword matching picks the fact. Swap this for an LLM or embeddings later;
// the scoring below stays the same.
export function matchFact(question: string, facts: Fact[]): Fact | null {
  const q = question.toLowerCase();
  let best: { fact: Fact; hits: number } | null = null;
  for (const fact of facts) {
    const hits = fact.keywords.filter((k) => q.includes(k.toLowerCase())).length;
    if (hits && (!best || hits > best.hits)) best = { fact, hits };
  }
  return best?.fact ?? null;
}

export function ask(question: string, ctx: Context, kb: KnowledgeBase, feedback: Feedback[] = [], now = new Date()): AskResult {
  const fact = matchFact(question, kb.facts);
  if (!fact) return { matched: false, message: "I couldn't match that to anything in the brain yet.", suggestions: kb.facts.map((f) => f.label) };

  const result = evaluateFact(fact, kb, ctx, feedback, now);
  const { best, status } = result;
  const people = Object.fromEntries(
    kb.people.filter((p) => [...result.claims, ...result.excluded].some((c) => c.claim.author === p.id)).map((p) => [p.id, p]),
  );
  const answer = !best
    ? `Nothing in the brain applies to your case (${describe(ctx)}).`
    : status === "conflict"
      ? `Sources disagree on ${fact.label.toLowerCase()}. Best supported: ${best.claim.value} (${pct(best.score)}). Check with an expert.`
      : `${fact.label}: ${best.claim.value} (${pct(best.score)} trusted).`;

  const warnings = result.claims
    .filter((c) => best && !sameValue(c.claim.value, best.claim.value))
    .map((c) => `${c.claim.source.title}${by(c.claim.author, kb)} says ${c.claim.value}, only ${pct(c.score)} trusted${c.caps[0] ? `: ${c.caps[0].split(": ")[1]}` : ""}`);

  // Prefer an expert who backs the best answer, then any expert who spoke on the topic.
  const experts = result.claims.map((c) => (c.claim.author ? people[c.claim.author] : undefined)).filter((p) => p?.role === "expert");
  const backing = result.claims.find((c) => best && sameValue(c.claim.value, best.claim.value) && c.claim.author && people[c.claim.author]?.role === "expert");
  const expert = (backing?.claim.author ? people[backing.claim.author] : experts[0]) ?? null;

  return { matched: true, answer, warnings, people, expert, ...result };
}

const by = (id: string | null, kb: KnowledgeBase) => {
  const name = id && kb.people.find((p) => p.id === id)?.name;
  return name ? ` (${name})` : "";
};
const pct = (n: number) => `${Math.round(n * 100)}%`;
const describe = (ctx: Context) => [ctx.country, ctx.pc && `PC ${ctx.pc}`, ctx.client].filter(Boolean).join(", ");
