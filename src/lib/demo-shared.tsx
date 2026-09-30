"use client";

import { useEffect, useRef, useState } from "react";
import { sources as internal, type Source } from "@/lib/knowledge";

// Scroll drives the whole demo: 0 → 1 across a tall section while the stage stays pinned.
export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export type Country = "BE" | "NL" | "EU";
export type DemoSource = Omit<Source, "country" | "channel"> & { country: Country; channel: string };

// Official legal texts the brain also searches (unofficial English wording for the demo).
const LAWS: DemoSource[] = [
  {
    id: "eu-883",
    title: "Regulation (EC) No 883/2004 – coordination of social security systems, Art. 11",
    short: "EU Reg. 883/2004",
    channel: "EUR-Lex",
    date: "2004-04-29",
    owner: "European Union",
    ownerActive: true,
    verifiedBy: "Official Journal of the EU",
    country: "EU",
    status: "final",
    text: `Persons to whom this Regulation applies shall be subject to the legislation of a single Member State only. A person pursuing an activity as an employed person in a Member State shall be subject to the legislation of that Member State. Sickness benefits in cash are provided by the competent institution in accordance with the legislation it applies.`,
  },
  {
    id: "be-law-1978",
    title: "Law of 3 July 1978 on employment contracts – guaranteed salary, Art. 70",
    short: "BE Law 3 July 1978",
    channel: "Belgian Official Journal",
    date: "2026-01-01",
    owner: "FPS Employment",
    ownerActive: true,
    verifiedBy: "Belgian Official Journal",
    country: "BE",
    status: "final",
    text: `An employee who is unable to work because of illness keeps the right to their normal salary during the first 30 days of incapacity. If a new incapacity starts within 8 weeks after the end of a previous one, it is considered a continuation: guaranteed salary is only due for the days not yet paid. Unless the employee proves a different illness. (Consolidated version, in force from 1 January 2026.)`,
  },
];

export const sources: DemoSource[] = [LAWS[0], LAWS[1], ...internal];
// Only the legal texts carry a flag, so they stand out from internal knowledge.
export const isLaw = (s: DemoSource) => LAWS.includes(s);

// Who wrote or signed each document (roles match the trust engine's people).
export const SIGNERS: Record<string, { name: string; role: string }> = {
  "eu-883": { name: "European Parliament & Council", role: "Official" },
  "be-law-1978": { name: "FPS Employment", role: "Official" },
  "policy-2026": { name: "An Peeters", role: "Expert · Legal Payroll BE" },
  "manual-2023": { name: "Koen Maes", role: "Left the company" },
  "nl-guide": { name: "Sanne de Vries", role: "Expert · Legal Payroll NL" },
  "teams-tom": { name: "Tom Claes", role: "New hire" },
  "faq-solidarity": { name: "SD Worx Communications", role: "Communications" },
  "draft-email": { name: "An Peeters", role: "Expert" },
};

// How each source looks as a document, and the sentence the scanner picks out.
export const DOCS: Record<string, { file: string; highlight: string }> = {
  "eu-883": { file: "EUR-Lex_32004R0883.pdf", highlight: "subject to the legislation of that Member State" },
  "be-law-1978": { file: "BE_Law_1978_Art70_EN.pdf", highlight: "within 8 weeks" },
  "policy-2026": { file: "BE_Sick_Leave_Policy_2026.pdf", highlight: "extended from 14 days to 8 weeks" },
  "manual-2023": { file: "Payroll_Manual_BE_v4.pdf", highlight: "more than 14 days after returning to work" },
  "nl-guide": { file: "Ziekteverzuim_NL.pdf", highlight: "within 4 weeks are added together" },
  "teams-tom": { file: "Teams_payroll-be_export.pdf", highlight: "relapse is still 14 days" },
  "faq-solidarity": { file: "Newsletter_Solidarity_2026.pdf", highlight: "at least 50 employees" },
  "draft-email": { file: "Legal_Relapse_DRAFT.pdf", highlight: "DRAFT – not voted yet" },
};

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setP(clamp(-r.top / (r.height - window.innerHeight)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return [ref, p] as const;
}

export function PdfIcon() {
  return (
    <svg viewBox="0 0 16 20" className="h-4 w-3.5 shrink-0">
      <path d="M2 0h8l6 6v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="#e5484d" />
      <path d="M10 0v4a2 2 0 0 0 2 2h4" fill="#ff9a9d" />
      <text x="8" y="15.5" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#fff">
        PDF
      </text>
    </svg>
  );
}

export function Flag({ country, size = 12 }: { country: Country; size?: number }) {
  const w = Math.round(size * 1.4);
  return (
    <svg viewBox="0 0 21 15" width={w} height={size} className="shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-label={country}>
      {country === "BE" && (
        <>
          <rect width="7" height="15" fill="#1a1a1a" />
          <rect x="7" width="7" height="15" fill="#fdda24" />
          <rect x="14" width="7" height="15" fill="#ef3340" />
        </>
      )}
      {country === "NL" && (
        <>
          <rect width="21" height="5" fill="#ae1c28" />
          <rect y="5" width="21" height="5" fill="#fff" />
          <rect y="10" width="21" height="5" fill="#21468b" />
        </>
      )}
      {country === "EU" && (
        <>
          <rect width="21" height="15" fill="#003399" />
          {Array.from({ length: 12 }, (_, k) => (
            <circle
              key={k}
              cx={(10.5 + 4.6 * Math.cos((k * Math.PI) / 6)).toFixed(2)}
              cy={(7.5 + 4.6 * Math.sin((k * Math.PI) / 6)).toFixed(2)}
              r="0.75"
              fill="#ffcc00"
            />
          ))}
        </>
      )}
    </svg>
  );
}
