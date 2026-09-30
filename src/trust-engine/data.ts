import { readFileSync } from "node:fs";
import path from "node:path";
import { mockKnowledgeBase } from "./mock";
import type { Claim, KnowledgeBase, SourceType } from "./types";

// Builds the knowledge base from the source files in data/salary. Server-only (reads files).
// Topics without data files yet keep their mock claims.

type DataClaim = {
  id: string;
  file: string;
  fact: string;
  value: string | null;
  sourceType: SourceType;
  title: string;
  author: string | null;
  date: string;
  effectiveFrom?: string;
  scope: { country: string; pc?: string; client?: string };
  reactions?: string[];
  corrects?: string;
};

export type TestQuestion = { question: string; context: { country?: string; pc?: string; client?: string }; expectedAnswer: string };

const ROOT = path.join(process.cwd(), "data", "salary");

// The sick-leave case files use an older format; link the mock claims to them by hand.
const SICK_LEAVE_FILES: Record<string, string> = {
  "tm-relapse-an": "sick-leave/01-policy-2026.md",
  "sp-manual-relapse": "sick-leave/02-manual-2023.md",
  "sp-nl-relapse": "sick-leave/03-nl-guide.md",
  "tm-relapse-tom": "sick-leave/04-teams-payroll-be.json",
  "em-relapse-draft": "sick-leave/06-draft-email-legal.eml",
};

const read = (file: string) => {
  try {
    return readFileSync(path.join(ROOT, file), "utf8");
  } catch {
    return "";
  }
};

type TeamsMessage = { createdDateTime: string; from?: { user?: { displayName?: string } }; body?: { content?: string }; replies?: TeamsMessage[] };
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

// Teams exports: the message by this author on this date (or containing the value).
function teamsQuote(fileText: string, author: string | undefined, date: string, value: string): string | null {
  try {
    const flat: TeamsMessage[] = [];
    const walk = (m: TeamsMessage) => (flat.push(m), (m.replies ?? []).forEach(walk));
    (JSON.parse(fileText).value as TeamsMessage[]).forEach(walk);
    const byAuthor = flat.filter((m) => !author || m.from?.user?.displayName === author);
    const m = byAuthor.find((x) => x.createdDateTime.startsWith(date)) ?? byAuthor.find((x) => stripHtml(x.body?.content ?? "").includes(value.split(" ")[0]));
    return m?.body?.content ? stripHtml(m.body.content) : null;
  } catch {
    return null;
  }
}

// The line in the file that states the value: that is the quote the brain shows.
function quote(fileText: string, value: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
  const needle = norm(value.split(" ")[0]);
  const line = fileText
    .split("\n")
    .map((l) => l.replace(/^[\s>#*\-|]+/, "").replace(/^"(text|message|body)":\s*"/, "").replace(/",?$/, "").trim())
    .find((l) => l.length > 8 && norm(l).includes(needle));
  return line ? (line.length > 240 ? `${line.slice(0, 237)}…` : line) : null;
}

export function loadDataKnowledgeBase(): { kb: KnowledgeBase; testQuestions: TestQuestion[] } {
  const raw = JSON.parse(read("sources.json") || "{}") as { claims?: DataClaim[]; testQuestions?: TestQuestion[] };
  const mockById = new Map(mockKnowledgeBase.claims.map((c) => [c.id, c]));
  const people = Object.fromEntries(mockKnowledgeBase.people.map((p) => [p.id, p]));

  const fromData: Claim[] = (raw.claims ?? [])
    .filter((d) => d.value)
    .map((d) => {
      const mock = mockById.get(d.id);
      return {
        id: d.id,
        factKey: d.fact,
        value: d.value!,
        scope: d.scope,
        source: { type: d.sourceType, title: d.title },
        author: d.author,
        date: d.date,
        effectiveFrom: d.effectiveFrom,
        text:
          (d.file.endsWith(".json") ? teamsQuote(read(d.file), d.author ? people[d.author]?.name : undefined, d.date, d.value!) : null) ??
          quote(read(d.file), d.value!) ??
          mock?.text ??
          d.title,
        reactions: d.reactions ?? mock?.reactions,
        corrects: d.corrects ?? mock?.corrects,
        file: d.file,
      };
    });

  // Keep mock claims only for topics the data files don't cover yet.
  const covered = new Set(fromData.map((c) => c.factKey));
  const fromMock = mockKnowledgeBase.claims
    .filter((c) => !covered.has(c.factKey))
    .map((c) => (SICK_LEAVE_FILES[c.id] ? { ...c, file: SICK_LEAVE_FILES[c.id] } : c));

  return {
    kb: { ...mockKnowledgeBase, claims: [...fromData, ...fromMock] },
    testQuestions: raw.testQuestions ?? [],
  };
}
