import type { Answer } from "./trust";

// Used when the Gemini call fails or no key is set, so the demo never breaks.
export const fallbackAnswer: Answer = {
  headline:
    "No new guaranteed salary: the relapse falls within 8 weeks, so it is the same illness. Yes, the solidarity contribution applies to this employer.",
  points: [
    {
      text: "The employee was back for 3 weeks, which is within the 8-week relapse period that applies from 1 January 2026. The new absence counts as the same illness.",
      sourceIds: ["policy-2026"],
    },
    {
      text: "The first absence already used the 30 days of guaranteed salary, so the health insurance fund pays from day 1 of the relapse.",
      sourceIds: ["policy-2026"],
    },
    {
      text: "With 80 employees and an employee aged 42, the employer pays 30% of the sickness benefit for months 2 and 3 of the incapacity. First invoice expected in Q4 2026.",
      sourceIds: ["policy-2026", "faq-solidarity"],
    },
  ],
  conflicts: [
    {
      summary:
        "Payroll manual v4 (2023) and a Teams message (Aug 2026) still say 14 days. The verified 2026 policy says 8 weeks. Under the old rule the employer would wrongly pay a new 30-day guaranteed salary.",
      sourceIds: ["manual-2023", "teams-tom", "policy-2026"],
    },
  ],
  askExpert: "An Peeters",
  nextAction: "Flag Payroll manual v4 as outdated and ask An Peeters to archive it.",
  readings: [
    {
      id: "policy-2026",
      claim: "Relapse period is 8 weeks from 2026; solidarity contribution for employers with 50+ staff.",
      relevant: true,
      consistent: true,
      note: "Matches the newsletter on the solidarity contribution",
    },
    {
      id: "manual-2023",
      claim: "Relapse after 14 days starts a new guaranteed salary period.",
      relevant: true,
      consistent: false,
      note: "Old 14-day rule, replaced by 8 weeks in 2026",
    },
    {
      id: "nl-guide",
      claim: "Illness periods within 4 weeks are added together (Netherlands).",
      relevant: false,
      consistent: true,
      note: "Dutch rules, not applicable in Belgium",
    },
    {
      id: "teams-tom",
      claim: "Relapse is still 14 days.",
      relevant: true,
      consistent: false,
      note: "Contradicts the verified 2026 policy",
    },
    {
      id: "faq-solidarity",
      claim: "Employers with 50+ staff pay 30% of sickness benefit for months 2–3.",
      relevant: true,
      consistent: true,
      note: "Agrees with the 2026 policy",
    },
    {
      id: "draft-email",
      claim: "Relapse period may be extended to 4 weeks (draft).",
      relevant: true,
      consistent: false,
      note: "Draft says 4 weeks; the published policy says 8 weeks",
    },
  ],
};
