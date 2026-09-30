import { ask, matchFact, parseContext } from "@/trust-engine";
import { matchFactWithGemini } from "@/lib/gemini-match";
import { currentUser, feedbackStore, forbidden, kb, now, readJson, unauthorized } from "@/lib/trust-server";
import { maskPersonalData } from "@/lib/privacy";
import { sameOrigin } from "@/lib/auth";

// POST { question, context: { country, pc?, client? } } -> answer with trust receipt
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!currentUser(request)) return unauthorized();
  const body = (await readJson(request)) as { question?: unknown; context?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.slice(0, 500) : "";
  const ctx = parseContext(body?.context, kb);
  if (!question || !ctx) return Response.json({ error: "question and a valid context are required" }, { status: 400 });
  // Keywords are instant; Gemini handles free text and other languages when they find nothing.
  // GDPR: names, ages and identifiers are masked before anything is sent to Gemini.
  const masked = maskPersonalData(question, [
    ...kb.people.flatMap((p) => [
      { label: "person", value: p.name },
      { label: "person", value: p.name.split(" ")[0] },
    ]),
    ...kb.clients.map((c) => ({ label: "client", value: c.name })),
  ]);
  const byKeywords = matchFact(question, kb.facts);
  const factKey = byKeywords ? null : await matchFactWithGemini(masked.text, kb.facts);
  const matchedBy = byKeywords ? "keywords" : factKey ? "gemini" : "none";
  const privacy = { masked: masked.text, redactions: masked.redactions, sentToAi: !byKeywords };
  return Response.json({ ...ask(question, ctx, kb, feedbackStore.all(), now(), factKey), matchedBy, privacy });
}
