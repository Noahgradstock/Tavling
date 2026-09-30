import { parseFeedback } from "@/trust-engine";
import { currentUser, feedbackStore, kb, now, readJson } from "@/lib/trust-server";

// POST { claimId, kind: correct|wrong|outdated|not_applicable, context } — the voter is the current user, never the body.
export async function POST(request: Request) {
  const userId = currentUser(request);
  if (!userId) return Response.json({ error: "not signed in" }, { status: 401 });
  const parsed = parseFeedback(await readJson(request), userId, kb, now());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  feedbackStore.put(parsed.feedback);
  return Response.json({ ok: true });
}
