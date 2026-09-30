import type { Metadata } from "next";
import { readdirSync } from "node:fs";
import path from "node:path";
import { evaluateFact } from "@/trust-engine";
import { feedbackStore, kb, now } from "@/lib/trust-server";
import { requireUser } from "@/lib/session";
import { DOC_FOLDERS, loadDocuments } from "@/lib/documents";
import BrainMap, { type BrainData } from "./brain-map";

export const metadata: Metadata = {
  title: "Company brain – map",
  description: "Everything the company brain knows, mapped around SD Worx.",
};
export const dynamic = "force-dynamic"; // feedback changes the trust status of topics

// Topics are scored for this client, so the map shows what a BE PC 200 consultant would get.
const REFERENCE_CLIENT = "brouwerij-de-kroon";

function listFiles(dir: string, base = dir): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? listFiles(path.join(dir, e.name), base) : e.name.startsWith(".") ? [] : [path.relative(base, path.join(dir, e.name))],
    );
  } catch {
    return [];
  }
}

export default async function BrainPage() {
  await requireUser();
  const client = kb.clients.find((c) => c.id === REFERENCE_CLIENT) ?? kb.clients[0];
  const ctx = { country: client.country, pc: client.pc, client: client.id };
  const feedback = feedbackStore.all();

  const topics = kb.facts.map((fact) => {
    const r = evaluateFact(fact, kb, ctx, feedback, now());
    const all = kb.claims.filter((c) => c.factKey === fact.key);
    return {
      key: fact.key,
      label: fact.label,
      status: r.best ? r.status : ("empty" as const),
      answer: r.best?.claim.value ?? null,
      score: r.best?.score ?? null,
      files: [...new Set(all.map((c) => c.file).filter((f): f is string => !!f))],
      claims: all.map((c) => {
        const scored = r.claims.find((s) => s.claim.id === c.id);
        return {
          id: c.id,
          value: c.value,
          source: c.source.type,
          title: c.source.title,
          author: c.author,
          date: c.date,
          country: c.scope.country,
          score: scored?.score ?? null,
          excluded: r.excluded.find((x) => x.claim.id === c.id)?.reason ?? null,
        };
      }),
    };
  });

  const data: BrainData = {
    company: "SD Worx",
    reference: `${client.name} (${[client.country, client.pc && `PC ${client.pc}`].filter(Boolean).join(", ")})`,
    topics,
    people: kb.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      team: p.team,
      left: !!p.left,
      claims: kb.claims.filter((c) => c.author === p.id).length,
    })),
    clients: kb.clients.map((c) => ({ ...c, claims: kb.claims.filter((x) => x.scope.client === c.id).length })),
    channels: (["official", "sharepoint", "teams", "email"] as const).map((type) => ({
      type,
      claims: kb.claims.filter((c) => c.source.type === type).length,
    })),
    files: listFiles(path.join(process.cwd(), "data", "salary")),
    documents: loadDocuments(kb),
    folders: DOC_FOLDERS,
    scores: Object.fromEntries(topics.flatMap((t) => t.claims.map((c) => [c.id, { score: c.score, excluded: c.excluded }]))),
  };

  return <BrainMap data={data} />;
}
