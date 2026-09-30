import { evaluateFact, parseContext } from "@/trust-engine";
import { allFeedback, currentUser, kb, notYourClient, now, unauthorized } from "@/lib/trust-server";
import { canReadClaim, canUseContext } from "@/lib/access";

// GET ?country=BE&pc=200&client=... -> every fact with status and scored claims (for the brain map)
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const p = new URL(request.url).searchParams;
  const ctx = parseContext({ country: p.get("country") ?? "", pc: p.get("pc") ?? "", client: p.get("client") ?? "" }, kb);
  if (!ctx) return Response.json({ error: "valid country or client required" }, { status: 400 });
  if (!canUseContext(user, ctx, kb)) return notYourClient();
  const feedback = await allFeedback();
  const facts = kb.facts.map((f) => {
    const r = evaluateFact(f, kb, ctx, feedback, now());
    return { ...r, excluded: r.excluded.filter((e) => canReadClaim(user, e.claim, kb)) };
  });
  return Response.json({ context: ctx, facts });
}
