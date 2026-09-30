import { parseFeedback } from "@/trust-engine";
import { currentUser, feedbackStore, forbidden, kb, now, readJson, unauthorized } from "@/lib/trust-server";
import { sameOrigin } from "@/lib/auth";

// POST { claimId, kind: correct|wrong|outdated|not_applicable, context } — the voter is the signed-in user, never the body.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  const user = currentUser(request);
  if (!user) return unauthorized();
  const parsed = parseFeedback(await readJson(request), user.id, kb, now());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  feedbackStore.put(parsed.feedback);
  return Response.json({ ok: true });
}
