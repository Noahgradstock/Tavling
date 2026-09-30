// Demo knowledge base for one fictional SD Worx client. All people and companies are invented.

export type Channel = "confluence" | "teams" | "email" | "word" | "pdf" | "memo";

export type Source = {
  id: string;
  title: string;
  channel: Channel;
  date: string; // ISO date of last update
  owner: string | null;
  ownerStatus: "active" | "left" | "unknown";
  verifiedBy?: string;
  country: "BE" | "NL";
  text: string;
  // Personal data that is masked before anything is sent to the AI.
  pii?: { value: string; label: string }[];
};

export const TODAY = "2026-09-30";

export const client = {
  name: "Brouwerij De Kroon NV",
  country: "BE" as const,
  jointCommittee: "PC 200 (white-collar)",
  previousConsultant: "Jan Peeters",
  newConsultant: "You",
};

export const sources: Source[] = [
  {
    id: "S1",
    title: "Handover note – De Kroon",
    channel: "word",
    date: "2025-06-12",
    owner: "Jan Peeters",
    ownerStatus: "active",
    country: "BE",
    text:
      "Client since 2019. 48 employees, all white-collar, PC 200. Payroll cut-off is the 20th of each month. " +
      "Overtime is paid according to the company CAO. 12 employees have a company car. " +
      "Main contact at the client: Els Vermeulen (HR), els.vermeulen@dekroon.be.",
    pii: [
      { value: "Els Vermeulen", label: "[CLIENT_CONTACT]" },
      { value: "els.vermeulen@dekroon.be", label: "[EMAIL]" },
    ],
  },
  {
    id: "S2",
    title: "Re: new colleagues after summer",
    channel: "email",
    date: "2026-08-21",
    owner: "Client HR",
    ownerStatus: "active",
    country: "BE",
    text:
      "Hi Jan, quick update: after our summer hires we are now at 57 employees. " +
      "Can you make sure the new starters are in the September payroll? Kind regards, Els Vermeulen, HR Brouwerij De Kroon.",
    pii: [{ value: "Els Vermeulen", label: "[CLIENT_CONTACT]" }],
  },
  {
    id: "S3",
    title: "Teams chat – Jan Peeters to payroll team",
    channel: "teams",
    date: "2026-03-04",
    owner: "Jan Peeters",
    ownerStatus: "active",
    country: "BE",
    text:
      "FYI De Kroon called: from April their payroll cut-off moves to the 18th. " +
      "Haven't updated the handover note yet.",
  },
  {
    id: "S4",
    title: "Sick leave in Belgium – guaranteed wage & relapse",
    channel: "confluence",
    date: "2024-03-12",
    owner: null,
    ownerStatus: "unknown",
    country: "BE",
    text:
      "White-collar workers: the employer pays guaranteed wage for the first 30 days of illness. " +
      "A relapse within 14 days after returning to work counts as the same illness, so no new guaranteed wage period starts.",
  },
  {
    id: "S5",
    title: "Legal memo: 2026 sickness reform – what changes for employers",
    channel: "memo",
    date: "2026-01-08",
    owner: "Sofie Claes (Legal expertise centre)",
    ownerStatus: "active",
    verifiedBy: "Sofie Claes",
    country: "BE",
    text:
      "From 1 January 2026 the relapse period is extended from 14 days to 8 weeks: a relapse within 8 weeks after returning " +
      "does not start a new guaranteed wage period. Employers with 50 or more employees pay a solidarity contribution of 30% " +
      "of the sickness benefit during the 2nd and 3rd month of incapacity, for workers under 55. First collection in Q4 2026.",
  },
  {
    id: "S6",
    title: "De Kroon – company CAO summary",
    channel: "confluence",
    date: "2023-02-02",
    owner: "Marc Dubois",
    ownerStatus: "left",
    country: "BE",
    text: "Company CAO De Kroon (2023): overtime above 38 hours per week is paid at 150%.",
  },
  {
    id: "S7",
    title: "Overtime rules – client template",
    channel: "pdf",
    date: "2025-05-15",
    owner: null,
    ownerStatus: "unknown",
    country: "NL",
    text: "Standard overtime supplement for clients: 125% for the first 2 hours, 150% thereafter.",
  },
];

export const people: Record<string, string> = {
  "Jan Peeters": "Previous consultant for De Kroon (now on another portfolio)",
  "Sofie Claes": "Legal expertise centre – Belgian social law",
  "Client HR": "HR department at the client",
};

export function maskSource(s: Source): string {
  let t = s.text;
  for (const p of s.pii ?? []) t = t.split(p.value).join(p.label);
  return t;
}

// ---------- Trust signals: plain, explainable rules. No AI involved. ----------

export type Signal = { ok: boolean; label: string };

export function monthsOld(date: string): number {
  const a = new Date(date);
  const b = new Date(TODAY);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function sourceSignals(s: Source): Signal[] {
  const age = monthsOld(s.date);
  return [
    s.verifiedBy
      ? { ok: true, label: `Verified by ${s.verifiedBy}` }
      : { ok: false, label: "Not verified by an expert" },
    age <= 12
      ? { ok: true, label: `Updated ${age} month${age === 1 ? "" : "s"} ago` }
      : { ok: false, label: `Last updated ${age} months ago` },
    s.ownerStatus === "active"
      ? { ok: true, label: `Owner: ${s.owner}` }
      : s.ownerStatus === "left"
        ? { ok: false, label: `Owner ${s.owner} has left` }
        : { ok: false, label: "No owner" },
    s.country === client.country
      ? { ok: true, label: "Applies to Belgium" }
      : { ok: false, label: `Written for ${s.country}, not Belgium` },
    ...(s.channel === "teams" ? [{ ok: false, label: "Informal chat message" }] : []),
  ];
}

export type Trust = "verified" | "check" | "conflict";

export function trustFor(recommended: Source | undefined, conflict: boolean): Trust {
  if (conflict) return "conflict";
  if (!recommended) return "check";
  return sourceSignals(recommended).every((x) => x.ok) ? "verified" : "check";
}

// ---------- Brief shape shared by the API and the UI ----------

export type Fact = {
  topic: string;
  statement: string;
  sourceIds: string[];
  recommendedSourceId: string;
  why: string;
  conflict: boolean;
  conflictSummary: string;
  askPerson: string;
  impact: string;
};

export type Brief = { summary: string; facts: Fact[] };
