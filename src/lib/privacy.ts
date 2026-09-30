// GDPR: strip personal data from a question before it leaves our server for an AI model.
// Pure function, runs on server and client. Redacted spans become ⟦label⟧ tokens.

export type Redaction = { label: string; count: number };
export type Masked = { text: string; redactions: Redaction[] };

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { label: "IBAN", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g },
  // Belgian national register number, e.g. 85.07.30-033.61
  { label: "national no.", re: /\b\d{2}\.?\d{2}\.?\d{2}[-.]?\d{3}\.?\d{2}\b/g },
  { label: "phone", re: /\+?\d[\d /-]{7,}\d/g },
  // Ages: "(42)", "42-year-old", "aged 42", "42 years old"
  { label: "age", re: /\((\d{2})\)|\b\d{2}[- ]years?[- ]old\b|\baged \d{2}\b/gi },
];

export function maskPersonalData(text: string, names: { label: string; value: string }[] = []): Masked {
  const counts = new Map<string, number>();
  const hit = (label: string) => {
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return `⟦${label}⟧`;
  };
  let out = text;
  // Longest names first, so "Brouwerij De Kroon NV" wins over "Brouwerij".
  for (const n of [...names].sort((a, b) => b.value.length - a.value.length)) {
    const escaped = n.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), () => hit(n.label));
  }
  for (const p of PATTERNS) out = out.replace(p.re, () => hit(p.label));
  return { text: out, redactions: [...counts].map(([label, count]) => ({ label, count })) };
}
