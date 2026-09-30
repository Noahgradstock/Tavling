import { customer, experts, sources, today } from "@/lib/knowledge";
import { fallbackAnswer } from "@/lib/fallback-answer";
import type { Answer } from "@/lib/trust";

const MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite"];

const idList = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, sourceIds: idList },
        required: ["text", "sourceIds"],
      },
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        properties: { summary: { type: "string" }, sourceIds: idList },
        required: ["summary", "sourceIds"],
      },
    },
    askExpert: { type: "string" },
    nextAction: { type: "string" },
    readings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          claim: { type: "string" },
          relevant: { type: "boolean" },
          consistent: { type: "boolean" },
          note: { type: "string" },
        },
        required: ["id", "claim", "relevant", "consistent", "note"],
      },
    },
  },
  required: ["headline", "points", "conflicts", "askExpert", "nextAction", "readings"],
};

const system = `You are the company brain of SD Worx. A payroll consultant must answer a customer question.
Use only the sources. Never invent rules or numbers.
1. readings: one entry per source id. claim = what the source says about the question, in one short sentence.
   relevant = false if the source does not apply to the customer (e.g. another country).
   consistent = false if the source contradicts the most reliable applicable source (prefer verified, final, recent, owned, same-country).
   A source for another country is not a contradiction: set consistent true, relevant false, and say why in note.
   note = the reason, max 10 words.
2. headline: the answer to the customer in one or two sentences.
3. points: 2-4 steps of reasoning applied to this customer's facts, each with the sourceIds that support it.
4. conflicts: every disagreement between applicable sources, naming both sides and what goes wrong if the wrong one is used.
5. askExpert: exactly one of: ${Object.keys(experts).join(", ")}.
6. nextAction: one sentence to fix the knowledge base.
In all text, refer to sources by their title, never by their id.
Short, concrete, English.`;

function isValid(a: unknown): a is Answer {
  const ids = new Set(sources.map((s) => s.id));
  if (!a || typeof a !== "object") return false;
  const x = a as Answer;
  return (
    Array.isArray(x.points) &&
    Array.isArray(x.readings) &&
    sources.every((s) => x.readings.some((r) => r.id === s.id)) &&
    x.points.every((p) => p.sourceIds.every((id) => ids.has(id)))
  );
}

export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ answer: fallbackAnswer, mode: "cached" });

  const context = sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} | ${s.channel} | updated ${s.date} | owner: ${s.owner ?? "none"}${s.ownerActive ? "" : " (left company)"}` +
        ` | verified: ${s.verifiedBy ?? "no"} | country: ${s.country} | status: ${s.status}\n${s.text}`,
    )
    .join("\n\n");

  const input =
    `Today: ${today}\nCustomer: ${customer.company}, ${customer.country}, ${customer.employees} employees\n` +
    `Question from ${customer.contact}: "${customer.question}"\n\nSources:\n${context}`;

  try {
    const call = (model: string) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          model,
          system_instruction: system,
          input,
          response_format: { type: "text", mime_type: "application/json", schema },
        }),
      });
    // The free tier is often overloaded (503/429), so fall through to other models.
    let res = await call(MODELS[0]);
    for (const model of MODELS.slice(1)) {
      if (res.status !== 503 && res.status !== 429) break;
      res = await call(model);
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const output = (data?.steps ?? []).findLast((s: { type?: string }) => s.type === "model_output");
    const text: string | undefined = output?.content?.find((c: { type?: string }) => c.type === "text")?.text;
    const answer = text ? JSON.parse(text) : null;
    if (!isValid(answer)) throw new Error("Invalid answer");
    return Response.json({ answer, mode: "live" });
  } catch (err) {
    console.error("answer generation failed, using cached answer:", err);
    return Response.json({ answer: fallbackAnswer, mode: "cached" });
  }
}
