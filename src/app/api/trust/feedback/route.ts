import { matchScope, parseFeedback } from "@/trust-engine";
import { allFeedback, currentUser, forbidden, kb, notYourClient, now, readJson, saveFeedback, tooManyRequests, unauthorized } from "@/lib/trust-server";
import { rateLimit, sameOrigin } from "@/lib/auth";
import { canUseContext } from "@/lib/access";

// POST { claimId, kind: correct|wrong|outdated|not_applicable, context } — the voter is the signed-in user, never the body.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  const user = await currentUser(request);
  if (!user) return unauthorized();
  if (!(await rateLimit(`vote:${user.id}`, 60, 60_000))) return tooManyRequests();
  const parsed = parseFeedback(await readJson(request), user.id, kb, now());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  // Only for cases this consultant works on.
  if (!canUseContext(user, parsed.feedback.context, kb)) return notYourClient();

  // A vote only counts for a case where the claim is actually shown: you cannot vote on a claim
  // for a country, sector or client it does not apply to (e.g. to hide it for other consultants).
  const claim = kb.claims.find((c) => c.id === parsed.feedback.claimId)!;
  const scope = matchScope(claim, parsed.feedback.context, await allFeedback());
  if (!scope.ok) return Response.json({ error: "This source does not apply to that case" }, { status: 400 });

  await saveFeedback(parsed.feedback);
  return Response.json({ ok: true });
}
