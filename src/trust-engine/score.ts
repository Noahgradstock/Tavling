import { CAPS, DEFAULT_HALF_LIFE_DAYS, HALF_LIFE_DAYS, POINTS, STATUS } from "./config";
import { matchScope } from "./scope";
import type {
  Claim,
  Context,
  Evidence,
  Fact,
  FactResult,
  FactStatus,
  Feedback,
  KnowledgeBase,
  Person,
  Relevance,
  ScoredClaim,
} from "./types";

const DAY = 86_400_000;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));
const specificity: Record<Relevance, number> = { client: 2, sector: 1, country: 0 };
const RELEVANCE_TAG: Record<Relevance, string> = { client: "Client-specific", sector: "Same sector", country: "Same country" };

export const sameValue = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, "").replace(",", ".") === b.toLowerCase().replace(/\s+/g, "").replace(",", ".");

// The official claim in force today that is most specific to the asker's case.
function officialReference(relevant: { claim: Claim; relevance: Relevance }[], now: Date): Claim | null {
  const inForce = relevant.filter(
    (r) => r.claim.source.type === "official" && Date.parse(r.claim.effectiveFrom ?? r.claim.date) <= now.getTime(),
  );
  inForce.sort(
    (a, b) =>
      specificity[b.relevance] - specificity[a.relevance] ||
      Date.parse(b.claim.effectiveFrom ?? b.claim.date) - Date.parse(a.claim.effectiveFrom ?? a.claim.date),
  );
  return inForce[0]?.claim ?? null;
}

function scoreClaim(
  claim: Claim,
  relevance: Relevance,
  fact: Fact,
  siblings: Claim[],
  ref: Claim | null,
  refRelevance: Relevance,
  people: Map<string, Person>,
  feedback: Feedback[],
  now: Date,
): ScoredClaim {
  const evidence: Evidence[] = [];
  const caps: { label: string; max: number }[] = [];
  const add = (layer: string, tag: string, label: string, points: number) => evidence.push({ layer, tag, label, points });
  const author = claim.author ? people.get(claim.author) : undefined;
  const isOfficial = claim.source.type === "official";

  // Layer 1 – authority
  if (isOfficial) add("authority", "Official", "Official publication", POINTS.official);
  else if (author?.role === "expert") add("authority", "Expert", `${author.name} is a topic expert`, POINTS.expertAuthor);
  else if (author?.role === "new") add("authority", "New hire", `${author.name} is new, no track record`, POINTS.newAuthor);
  if (author?.left) add("authority", "No owner", `${author.name} has left, nobody owns this anymore`, POINTS.ownerLeft);

  // Layer 2 – freshness. Official rules stay valid until replaced, so they do not age.
  if (!isOfficial) {
    const ageDays = (now.getTime() - Date.parse(claim.date)) / DAY;
    const halfLife = HALF_LIFE_DAYS[fact.topic] ?? DEFAULT_HALF_LIFE_DAYS;
    const penalty = -Math.min(POINTS.maxAgePenalty, ageDays / halfLife);
    if (penalty < -0.05) add("freshness", `${Math.round(ageDays / 30)} months old`, `Written ${Math.round(ageDays / 30)} months ago`, penalty);
  }
  const refStart = ref ? Date.parse(ref.effectiveFrom ?? ref.date) : null;
  const claimStart = Date.parse(claim.effectiveFrom ?? claim.date);
  const matchesRef = ref ? sameValue(claim.value, ref.value) : false;
  if (ref && claim.id !== ref.id && refStart !== null && claimStart < refStart && !matchesRef) {
    add("freshness", "Old rule", `Written before the rule change of ${ref.effectiveFrom}`, POINTS.predatesRuleChange);
    caps.push({ label: "predates the current rule", max: CAPS.predatesRuleChange });
  }

  // Layer 3 – corroboration
  const expertThumbs = (claim.reactions ?? []).filter((id) => id !== claim.author && people.get(id)?.role === "expert");
  const thumbs = Math.min(expertThumbs.length, POINTS.maxExpertReactions);
  if (thumbs) add("corroboration", `${thumbs}× expert 👍`, `👍 from ${thumbs} expert${thumbs > 1 ? "s" : ""}`, thumbs * POINTS.expertReaction);
  const agreeing = isOfficial ? 0 : new Set(
    siblings
      .filter((c) => c.id !== claim.id && c.source.type !== "official" && c.author !== claim.author && sameValue(c.value, claim.value))
      .map((c) => c.author),
  ).size;
  const agreements = Math.min(agreeing, POINTS.maxAgreements);
  if (agreements) add("corroboration", "Others agree", `${agreements} other colleague${agreements > 1 ? "s" : ""} said the same`, agreements * POINTS.agreement);
  const corrections = siblings.filter((c) => c.corrects === claim.id && !sameValue(c.value, claim.value));
  for (const c of corrections) {
    const who = c.author ? people.get(c.author)?.name : undefined;
    add("corroboration", "Corrected", `Corrected by ${who ?? "a colleague"}`, POINTS.corrected);
  }

  // Layer 4 – consistency with the official source. A client agreement that deviates from a
  // sector or country rule is an exception, not a contradiction.
  const isException = !!ref && !isOfficial && !matchesRef && specificity[relevance] > specificity[refRelevance];
  if (isException) add("consistency", "Client exception", `Client agreement that deviates from ${ref!.source.title}`, POINTS.clientException);
  else if (ref && !isOfficial) {
    if (matchesRef) add("consistency", "Matches law", `Matches ${ref.source.title}`, POINTS.matchesOfficial);
    else {
      add("consistency", "Contradicts law", `Contradicts ${ref.source.title} (${ref.value})`, POINTS.contradictsOfficial);
      caps.push({ label: "contradicts the official source", max: CAPS.contradictsOfficial });
    }
  }
  if (!isOfficial && author?.role !== "expert" && thumbs === 0 && !matchesRef && !isException) {
    caps.push({ label: "no expert or official source backs it", max: CAPS.noExpertBacking });
  }

  // Layer 5 – relevance to the asker's case
  add("relevance", RELEVANCE_TAG[relevance], `Applies at ${relevance} level`, POINTS.relevance[relevance]);

  // Layer 6 – usage feedback, weighted by who gives it
  const votes = feedback.filter((f) => f.claimId === claim.id && f.kind !== "not_applicable");
  if (votes.length) {
    const weight = (f: Feedback) => POINTS.voterWeight[people.get(f.userId)?.role ?? "regular"];
    const correct = votes.filter((f) => f.kind === "correct").reduce((s, f) => s + weight(f), 0);
    const wrong = votes.filter((f) => f.kind === "wrong").reduce((s, f) => s + weight(f), 0);
    const outdated = votes.filter((f) => f.kind === "outdated").length;
    const summary = `${votes.filter((f) => f.kind === "correct").length} said correct, ${votes.filter((f) => f.kind === "wrong").length} wrong, ${outdated} outdated`;
    if (isOfficial && (wrong > 0 || outdated > 0)) {
      // Users cannot vote down the law. Negative votes flag it for a human check instead.
      add("feedback", "Flagged", `${summary}: flagged for expert review`, 0);
    } else {
      const points = clamp(Math.log(1 + correct) - Math.log(1 + wrong) + outdated * POINTS.outdatedVote, POINTS.feedbackCap);
      add("feedback", points >= 0 ? "Users confirm" : "Users disagree", `Consultant feedback: ${summary}`, points);
    }
  }

  const raw = sigmoid(evidence.reduce((s, e) => s + e.points, 0));
  const cap = caps.reduce((m, c) => Math.min(m, c.max), 1);
  return {
    claim,
    score: round(Math.min(raw, cap)),
    relevance,
    evidence: evidence.map((e) => ({ ...e, points: round(e.points) })),
    caps: caps.filter((c) => c.max < raw).map((c) => `Capped at ${c.max * 100}%: ${c.label}`),
  };
}

// Score every claim for one fact, from the point of view of one consultant's case.
export function evaluateFact(fact: Fact, kb: KnowledgeBase, ctx: Context, feedback: Feedback[] = [], now = new Date()): FactResult {
  const people = new Map(kb.people.map((p) => [p.id, p]));
  const relevant: { claim: Claim; relevance: Relevance }[] = [];
  const excluded: FactResult["excluded"] = [];

  for (const claim of kb.claims.filter((c) => c.factKey === fact.key)) {
    const m = matchScope(claim, ctx, feedback);
    if (m.ok) relevant.push({ claim, relevance: m.relevance });
    else excluded.push({ claim, reason: m.reason });
  }

  const ref = officialReference(relevant, now);
  const refRelevance = relevant.find((r) => r.claim.id === ref?.id)?.relevance ?? "country";
  const siblings = relevant.map((r) => r.claim);
  const claims = relevant
    .map((r) => scoreClaim(r.claim, r.relevance, fact, siblings, ref, refRelevance, people, feedback, now))
    .sort((a, b) => b.score - a.score || specificity[b.relevance] - specificity[a.relevance]);

  // The most specific trusted claim wins (a client agreement beats the sector rule); otherwise the highest score.
  const trusted = claims.filter((c) => c.score >= STATUS.trusted);
  const best = trusted.sort((a, b) => specificity[b.relevance] - specificity[a.relevance] || b.score - a.score)[0] ?? claims[0] ?? null;
  if (best) {
    claims.splice(claims.indexOf(best), 1);
    claims.unshift(best);
  }
  return { fact, status: statusOf(best, claims, people), best, claims, excluded };
}

function statusOf(best: ScoredClaim | null, claims: ScoredClaim[], people: Map<string, Person>): FactStatus {
  if (!best) return "orphan";
  // A more specific claim (e.g. a client agreement) overriding a general one is an exception, not a conflict.
  const rival = claims.find(
    (c) =>
      !sameValue(c.claim.value, best.claim.value) &&
      c.score >= STATUS.usable &&
      specificity[c.relevance] >= specificity[best.relevance],
  );
  if (rival && best.score >= STATUS.usable) return "conflict";
  const backed = claims.some(
    (c) =>
      c.claim.source.type === "official" ||
      (c.claim.author && people.get(c.claim.author)?.role === "expert") ||
      (c.claim.reactions ?? []).some((id) => people.get(id)?.role === "expert"),
  );
  if (!backed) return "orphan";
  return best.score >= STATUS.trusted ? "trusted" : "stale";
}
