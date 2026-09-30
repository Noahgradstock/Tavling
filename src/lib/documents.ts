import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { KnowledgeBase } from "@/trust-engine";

// The source documents behind the salary knowledge, parsed for the document viewer. Server-only (reads files).

export type DocKind = "PDF" | "Policy" | "Guide" | "Official" | "SharePoint" | "Confluence" | "Email" | "Teams" | "Newsletter";

export type DocBody =
  | { type: "text"; text: string; mono: boolean }
  | { type: "markdown"; text: string }
  | { type: "email"; from: string; to: string; cc?: string; date: string; subject: string; text: string }
  | { type: "chat"; channel: string; messages: { author: string; date: string; text: string; reply: boolean }[] }
  | { type: "html"; html: string };

export type DocClaim = { id: string; fact: string; value: string };

export type Doc = {
  path: string; // relative to data/salary, e.g. "indexation/01-official-notice-pc200-2026.txt"
  folder: string;
  kind: DocKind;
  title: string;
  date: string | null;
  author: string | null;
  excerpt: string;
  claims: DocClaim[];
  body: DocBody;
};

const ROOT = path.join(process.cwd(), "data", "salary");
// Every folder under data/salary is a topic with documents, except meal-voucher-scenario (engine data, not documents).
const NOT_DOCUMENTS = new Set(["meal-voucher-scenario"]);
const FOLDER_LABELS: Record<string, string> = {
  "bonus-and-holiday-pay": "Bonus & holiday pay",
  "company-car": "Company car",
  "eco-vouchers": "Eco vouchers",
  "minimum-wage": "Minimum wage",
  "sick-note": "Sick note",
  process: "Payroll process",
};
const labelOf = (folder: string) => FOLDER_LABELS[folder] ?? folder.charAt(0).toUpperCase() + folder.slice(1).replace(/-/g, " ");

// Folder id -> readable name, for every document folder that exists right now.
export function docFolders(): Record<string, string> {
  try {
    return Object.fromEntries(
      readdirSync(ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !NOT_DOCUMENTS.has(e.name))
        .map((e) => [e.name, labelOf(e.name)])
        .sort((a, b) => a[1].localeCompare(b[1])),
    );
  } catch {
    return {};
  }
}

const stripHtml = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

type TeamsMessage = { createdDateTime: string; from?: { user?: { displayName?: string } }; body?: { content?: string }; replies?: TeamsMessage[] };

function parseEmail(raw: string): DocBody {
  const [head, ...rest] = raw.replace(/\r/g, "").split("\n\n");
  const h = (k: string) => head.match(new RegExp(`^${k}:\\s*(.*)$`, "mi"))?.[1]?.trim() ?? "";
  return { type: "email", from: h("From"), to: h("To"), cc: h("Cc") || undefined, date: h("Date"), subject: h("Subject"), text: rest.join("\n\n").trim() };
}

function parseTeams(raw: string): DocBody {
  try {
    const json = JSON.parse(raw) as { "@odata.context"?: string; value: TeamsMessage[] };
    const channel = decodeURIComponent(json["@odata.context"]?.match(/channels\('([^']+)'\)/)?.[1] ?? "").replace(/^19:/, "#") || "#channel";
    const messages: Extract<DocBody, { type: "chat" }>["messages"] = [];
    const walk = (m: TeamsMessage, reply: boolean) => {
      messages.push({ author: m.from?.user?.displayName ?? "Unknown", date: m.createdDateTime, text: stripHtml(m.body?.content ?? ""), reply });
      (m.replies ?? []).forEach((r) => walk(r, true));
    };
    json.value.forEach((m) => walk(m, false));
    return { type: "chat", channel, messages };
  } catch {
    return { type: "text", text: raw, mono: true };
  }
}

function kindOf(file: string, raw: string): DocKind {
  const first = raw.trimStart().split("\n")[0].toLowerCase();
  if (file.endsWith(".eml")) return "Email";
  if (file.endsWith(".json")) return "Teams";
  if (file.endsWith(".html")) return "Newsletter";
  if (file.endsWith(".md") && first.startsWith("#")) return "Guide";
  if (first.includes(".pdf")) return "PDF";
  if (first.startsWith("confluence")) return "Confluence";
  if (first.startsWith("sharepoint")) return "SharePoint";
  if (file.endsWith(".txt")) return "Official";
  return "Policy";
}

const clipText = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 180 ? `${t.slice(0, 177).replace(/\s\S*$/, "")}…` : t;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// Newsletters carry their month in the title, e.g. "Client Update Belgium – January 2026".
function newsletterDate(raw: string): string | null {
  const m = raw.match(/<title>[^<]*?\b([A-Z][a-z]+) (\d{4})/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && month >= 0 ? `${m[2]}-${String(month + 1).padStart(2, "0")}-01` : null;
}

// First real sentence of the text: skips breadcrumbs, separators, metadata lines and headings.
function excerptOf(text: string): string {
  const para = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .find(
      (p) =>
        p.length > 60 &&
        /[.!?]/.test(p) &&
        !/[-=]{6}|\.pdf|\||Label:|laatst bijgewerkt/i.test(p) &&
        !/^[\w ]+:\s/.test(p) &&
        !p.includes(" > "),
    );
  const s = para ?? text.replace(/\s+/g, " ").trim();
  return s.length > 180 ? `${s.slice(0, 177).replace(/\s\S*$/, "")}…` : s;
}

function titleOf(kind: DocKind, raw: string, body: DocBody): string {
  if (body.type === "email") return body.subject;
  if (body.type === "chat") return `Teams ${body.channel}`;
  if (body.type === "html") return raw.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "Newsletter";
  if (body.type === "markdown") return raw.match(/^#\s+(.+)$/m)?.[1] ?? "Guide";
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (kind === "PDF") return lines.find((l) => l.includes("|"))?.split("|")[1]?.trim() ?? lines[0];
  const title = lines.find((l) => /^title:/i.test(l));
  if (title) return title.replace(/^title:\s*/i, "");
  return lines.find((l, i) => i > 0 && !l.includes(">") && !/^[\w ]+:\s/.test(l)) ?? lines[0];
}

export function loadDocuments(kb: KnowledgeBase): Doc[] {
  const people = new Map(kb.people.map((p) => [p.id, p.name]));
  const facts = new Map(kb.facts.map((f) => [f.key, f.label]));

  return Object.keys(docFolders()).flatMap((folder) => {
    let files: string[] = [];
    try {
      files = readdirSync(path.join(ROOT, folder)).filter((f) => /\.(md|txt|eml|json|html)$/.test(f) && !f.startsWith("sources"));
    } catch {
      return [];
    }
    return files.sort().map((name): Doc => {
      const rel = `${folder}/${name}`;
      const raw = readFileSync(path.join(ROOT, rel), "utf8");
      const kind = kindOf(name, raw);
      const body: DocBody =
        kind === "Email" ? parseEmail(raw) : kind === "Teams" ? parseTeams(raw) : kind === "Newsletter"
              ? { type: "html", html: raw }
              : kind === "Guide"
                ? { type: "markdown", text: raw.trim() }
                : { type: "text", text: raw.trim(), mono: kind === "PDF" };

      const claims = kb.claims.filter((c) => c.file === rel);
      const dates = claims.map((c) => c.date).sort();
      const author = claims.find((c) => c.author)?.author;
      const emailDate = body.type === "email" && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date).toISOString().slice(0, 10) : null;
      const plain =
        body.type === "email" ? body.text : body.type === "chat" ? body.messages.map((m) => m.text).join("\n\n") : body.type === "html"
              ? stripHtml(raw.replace(/<head>[\s\S]*<\/head>/i, ""))
              : body.type === "markdown"
                ? body.text.replace(/^#.*$/gm, "").replace(/[*_`]/g, "")
                : body.text;

      return {
        path: rel,
        folder,
        kind,
        // The claim title is the brain's own English name for the document; emails and chats keep theirs.
        title: (body.type === "text" && claims[0] && claims[0].source.type !== "teams" && claims[0].source.title) || titleOf(kind, raw, body),
        // A Teams thread is dated and signed by its first message; its summary is that message.
        date: body.type === "chat" ? body.messages[0]?.date.slice(0, 10) ?? null : dates[0] ?? emailDate ?? newsletterDate(raw),
        author: body.type === "chat" ? body.messages[0]?.author ?? null : (author && people.get(author)) || (body.type === "email" ? body.from.replace(/\s*<.*>/, "") : null),
        excerpt: body.type === "chat" ? clipText(body.messages[0]?.text ?? "") : excerptOf(plain),
        claims: claims.map((c) => ({ id: c.id, fact: facts.get(c.factKey) ?? c.factKey, value: c.value })),
        body,
      };
    });
  });
}
