import { readFileSync } from "node:fs";
import path from "node:path";
import { mockKnowledgeBase } from "./mock";
import type { Claim, Client, Fact, KnowledgeBase, Person, SourceType } from "./types";

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
    const baseFull = path.resolve(ROOT);
    const target = path.join(baseFull, file);
    const rel = path.relative(baseFull, target);
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      return "";
    }
    return readFileSync(target, "utf8");
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

// The sentence in the file that states the value: that is the quote the brain shows.
// Wrapped lines are joined first so a sentence is never cut in half.
function quote(fileText: string, value: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
  // Whole token only: "12" must not match "PC 124", "8" must not match "1978".
  // Currency is dropped: files write "8,91 EUR" or "EUR 6.91" where the claim says "€8.91".
  const esc = norm(value.split(" ")[0]).replace(/^€/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const needle = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}]|[.,]\\p{N})`, "u");
  const sentences = fileText
    .replace(/<[^>]+>/g, " ")
    .split(/\n\s*\n/)
    // Skip email header blocks (From:, To:, Subject: …).
    .filter((para) => !/^(From|To|Date|Subject|Message-ID|MIME-Version|Content-[\w-]+):/m.test(para))
    .map((para) => para.split("\n").map((l) => l.replace(/^[\s>#*\-|]+/, "").trim()).join(" "))
    .flatMap((para) => para.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/))
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => !/^\d+\.?$/.test(x)); // drop list numbers like "3."
  // Prefer the sentence with the full value ("3 times per year"), then the first token on its own.
  let k = sentences.findIndex((x) => x.length > 8 && norm(x).includes(norm(value)));
  if (k < 0) k = sentences.findIndex((x) => x.length > 8 && needle.test(norm(x)));
  if (k < 0) return null;
  const text = sentences[k];
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

// The full source behind a claim, for the document viewer. Teams exports become a message list.
export type SourceDoc =
  | { kind: "messages"; file: string; messages: { author: string; date: string; text: string }[] }
  | { kind: "text"; file: string; text: string }
  | { kind: "none" };

export function readSource(claim: Claim): SourceDoc {
  if (!claim.file) return { kind: "none" };
  const raw = read(claim.file);
  if (!raw) return { kind: "none" };
  if (claim.file.endsWith(".json")) {
    try {
      const flat: TeamsMessage[] = [];
      const walk = (m: TeamsMessage) => (flat.push(m), (m.replies ?? []).forEach(walk));
      (JSON.parse(raw).value as TeamsMessage[]).forEach(walk);
      return {
        kind: "messages",
        file: claim.file,
        messages: flat.map((m) => ({ author: m.from?.user?.displayName ?? "Unknown", date: m.createdDateTime, text: stripHtml(m.body?.content ?? "") })),
      };
    } catch {
      /* fall through to plain text */
    }
  }
  return { kind: "text", file: claim.file, text: raw.replace(/<[^>]+>/g, "") };
}

type DataFile = {
  claims?: DataClaim[];
  testQuestions?: TestQuestion[];
  facts?: Fact[];
  people?: Record<string, Omit<Person, "id">>;
  clients?: Record<string, Omit<Client, "id">>;
};

// Every file listed here adds claims, and optionally topics, people and clients.
const SOURCE_FILES = ["sources.json", "sources-more.json"];

export function loadDataKnowledgeBase(): { kb: KnowledgeBase; testQuestions: TestQuestion[] } {
  const files = SOURCE_FILES.map((f) => JSON.parse(read(f) || "{}") as DataFile);
  const raw = { claims: files.flatMap((f) => f.claims ?? []), testQuestions: files.flatMap((f) => f.testQuestions ?? []) };
  const extraPeople = files.flatMap((f) => Object.entries(f.people ?? {}).map(([id, p]) => ({ id, ...p }) as Person));
  const extraClients = files.flatMap((f) => Object.entries(f.clients ?? {}).map(([id, c]) => ({ id, ...c }) as Client));
  const extraFacts = files.flatMap((f) => f.facts ?? []);
  const merge = <T extends { id?: string; key?: string }>(base: T[], extra: T[]) => {
    const k = (x: T) => x.id ?? x.key;
    return [...base, ...extra.filter((e) => !base.some((b) => k(b) === k(e)))];
  };
  const allPeople = merge(mockKnowledgeBase.people, extraPeople);
  const mockById = new Map(mockKnowledgeBase.claims.map((c) => [c.id, c]));
  const people = Object.fromEntries(allPeople.map((p) => [p.id, p]));

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
    kb: {
      facts: merge(mockKnowledgeBase.facts, extraFacts),
      people: allPeople,
      clients: merge(mockKnowledgeBase.clients, extraClients),
      claims: [...fromData, ...fromMock],
    },
    testQuestions: raw.testQuestions ?? [],
  };
}
