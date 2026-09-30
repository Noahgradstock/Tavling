import { matchScope, parseFeedback } from "@/trust-engine";
import { currentUser, feedbackStore, forbidden, kb, now, readJson, tooManyRequests, unauthorized } from "@/lib/trust-server";
import { rateLimit, sameOrigin } from "@/lib/auth";

// POST { claimId, kind: correct|wrong|outdated|not_applicable, context } — the voter is the signed-in user, never the body.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  const user = currentUser(request);
  if (!user) return unauthorized();
  if (!rateLimit(`vote:${user.id}`, 60, 60_000)) return tooManyRequests();
  const parsed = parseFeedback(await readJson(request), user.id, kb, now());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // A vote only counts for a case where the claim is actually shown: you cannot vote on a claim
  // for a country, sector or client it does not apply to (e.g. to hide it for other consultants).
  const claim = kb.claims.find((c) => c.id === parsed.feedback.claimId)!;
  const scope = matchScope(claim, parsed.feedback.context, feedbackStore.all());
  if (!scope.ok) return Response.json({ error: "This source does not apply to that case" }, { status: 400 });

  feedbackStore.put(parsed.feedback);
  return Response.json({ ok: true });
}
