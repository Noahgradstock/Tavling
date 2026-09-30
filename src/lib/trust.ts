import { customer, today, type Source } from "./knowledge";

// What the AI reads from each source. Everything else in the score is metadata we can check.
export type SourceReading = {
  id: string;
  claim: string;
  relevant: boolean;
  consistent: boolean;
  note: string;
};

export type Answer = {
  headline: string;
  points: { text: string; sourceIds: string[] }[];
  conflicts: { summary: string; sourceIds: string[] }[];
  askExpert: string;
  nextAction: string;
  readings: SourceReading[];
};

export type Signal = { key: string; label: string; ok: boolean; weight: number; detail: string };

export type Trust = {
  score: number;
  level: "trusted" | "care" | "avoid";
  signals: Signal[];
  capReason: string | null;
};

const DAY = 86_400_000;

export function scoreSource(s: Source, reading?: SourceReading): Trust {
  const ageDays = Math.round((Date.parse(today) - Date.parse(s.date)) / DAY);
  const freshness = Math.max(0, 1 - ageDays / 730);
  const months = Math.round(ageDays / 30);

  const signals: Signal[] = [
    {
      key: "country",
      label: s.country === customer.country ? "Right country" : "Other country",
      ok: s.country === customer.country,
      weight: 25,
      detail: `Written for ${s.country}, customer is in ${customer.country}`,
    },
    {
      key: "consistent",
      label: reading?.consistent === false ? "Conflicts" : "Consistent",
      ok: reading ? reading.consistent : true,
      weight: 25,
      detail: reading?.note || "Not checked yet",
    },
    {
      key: "verified",
      label: s.verifiedBy ? "Verified" : "Unverified",
      ok: !!s.verifiedBy,
      weight: 20,
      detail: s.verifiedBy ? `Checked by ${s.verifiedBy}` : "No expert has reviewed this",
    },
    {
      key: "fresh",
      label: freshness > 0.5 ? "Recent" : "Outdated",
      ok: freshness > 0.5,
      weight: Math.round(15 * freshness),
      detail: `Updated ${s.date} (${months} months ago)`,
    },
    {
      key: "owned",
      label: s.owner && s.ownerActive ? "Has owner" : "No owner",
      ok: !!s.owner && s.ownerActive,
      weight: 10,
      detail: s.owner ? `${s.owner}${s.ownerActive ? "" : " has left the company"}` : "Nobody owns this",
    },
    {
      key: "final",
      label: s.status === "final" ? "Final" : "Draft",
      ok: s.status === "final",
      weight: 5,
      detail: s.status === "final" ? "Published version" : "Marked as draft, not for clients",
    },
  ];

  let score = signals.reduce((sum, sig) => sum + (sig.ok ? sig.weight : 0), 0);
  let capReason: string | null = null;
  // Hard caps: a source for another country or one that contradicts better sources is never "trusted".
  if (s.country !== customer.country) {
    score = Math.min(score, 15);
    capReason = "Capped: does not apply to this customer's country";
  } else if (reading && !reading.consistent) {
    score = Math.min(score, 40);
    capReason = "Capped: contradicts more reliable sources";
  }

  const level = score >= 75 ? "trusted" : score >= 45 ? "care" : "avoid";
  return { score, level, signals, capReason };
}
