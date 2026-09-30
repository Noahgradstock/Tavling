import { evaluateFact, parseContext } from "@/trust-engine";
import { currentUser, feedbackStore, kb, now, unauthorized } from "@/lib/trust-server";

// GET ?country=BE&pc=200&client=... -> every fact with status and scored claims (for the brain map)
export async function GET(request: Request) {
  if (!currentUser(request)) return unauthorized();
  const p = new URL(request.url).searchParams;
  const ctx = parseContext({ country: p.get("country") ?? "", pc: p.get("pc") ?? "", client: p.get("client") ?? "" }, kb);
  if (!ctx) return Response.json({ error: "valid country or client required" }, { status: 400 });
  const feedback = feedbackStore.all();
  return Response.json({ context: ctx, facts: kb.facts.map((f) => evaluateFact(f, kb, ctx, feedback, now())) });
}
