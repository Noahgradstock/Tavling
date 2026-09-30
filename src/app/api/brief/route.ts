import { client, maskSource, people, sources, type Brief } from "@/lib/knowledge";
import { fallbackBrief } from "@/lib/fallback-brief";

const MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite"];

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          statement: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" } },
          recommendedSourceId: { type: "string" },
          why: { type: "string" },
          conflict: { type: "boolean" },
          conflictSummary: { type: "string" },
          askPerson: { type: "string" },
          impact: { type: "string" },
        },
        required: [
          "topic", "statement", "sourceIds", "recommendedSourceId",
          "why", "conflict", "conflictSummary", "askPerson", "impact",
        ],
      },
    },
  },
  required: ["summary", "facts"],
};

const system = `You help a payroll consultant at SD Worx who is taking over a client portfolio.
Build a handover brief from the sources only. Never invent facts that are not in the sources.
Group what the sources say into 4-6 facts that matter for running this client's payroll.
For each fact:
- sourceIds: every source that says something about it.
- recommendedSourceId: the source to rely on (prefer verified, recent, owned, same-country sources).
- conflict: true whenever two sources that apply to this client give different values, even if one is newer, UNLESS the newer one is verified by an expert. Never silently pick the newer value: a consultant must confirm it. A source written for another country is not a conflict: explain in "why" that it does not apply.
- conflictSummary: when conflict is true, name both sources and both values in one sentence, e.g. "Handover note (Jun 2025) says X, client email (Aug 2026) says Y". Otherwise empty.
- askPerson: exactly one of: ${Object.keys(people).join(", ")}.
- impact: one sentence on what goes wrong in payroll if this is wrong.
Keep every string short and concrete. Write in English.`;

function isValidBrief(b: unknown): b is Brief {
  const ids = new Set(sources.map((s) => s.id));
  if (!b || typeof b !== "object") return false;
  const facts = (b as Brief).facts;
  return (
    Array.isArray(facts) &&
    facts.length > 0 &&
    facts.every((f) => ids.has(f.recommendedSourceId) && f.sourceIds.every((id) => ids.has(id)))
  );
}

export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ brief: fallbackBrief, mode: "cached" });

  const context = sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} | ${s.channel} | updated ${s.date} | owner: ${s.owner ?? "none"} (${s.ownerStatus})` +
        `${s.verifiedBy ? ` | verified by ${s.verifiedBy}` : ""} | country: ${s.country}\n${maskSource(s)}`,
    )
    .join("\n\n");

  try {
    const call = (model: string) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model,
          system_instruction: system,
          input: `Client: ${client.name} (${client.country}, ${client.jointCommittee})\nToday: 2026-09-30\n\nSources:\n${context}`,
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
    const brief = text ? JSON.parse(text) : null;
    if (!isValidBrief(brief)) throw new Error("Invalid brief");
    return Response.json({ brief, mode: "live" });
  } catch (err) {
    console.error("brief generation failed, using cached brief:", err);
    return Response.json({ brief: fallbackBrief, mode: "cached" });
  }
}
