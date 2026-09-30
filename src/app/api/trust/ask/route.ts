import { ask, matchFact, parseContext } from "@/trust-engine";
import { matchFactWithGemini } from "@/lib/gemini-match";
import { feedbackStore, kb, now, readJson } from "@/lib/trust-server";

// POST { question, context: { country, pc?, client? } } -> answer with trust receipt
export async function POST(request: Request) {
  const body = (await readJson(request)) as { question?: unknown; context?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.slice(0, 500) : "";
  const ctx = parseContext(body?.context, kb);
  if (!question || !ctx) return Response.json({ error: "question and a valid context are required" }, { status: 400 });
  // Keywords are instant; Gemini handles free text and other languages when they find nothing.
  const byKeywords = matchFact(question, kb.facts);
  const factKey = byKeywords ? null : await matchFactWithGemini(question, kb.facts);
  const matchedBy = byKeywords ? "keywords" : factKey ? "gemini" : "none";
  return Response.json({ ...ask(question, ctx, kb, feedbackStore.all(), now(), factKey), matchedBy });
}
