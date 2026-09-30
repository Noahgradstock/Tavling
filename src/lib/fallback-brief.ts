import type { Brief } from "./knowledge";

// Pre-computed brief used when the AI call fails, so the demo never breaks.
export const fallbackBrief: Brief = {
  summary:
    "De Kroon has grown past 50 employees, which brings it under the 2026 solidarity contribution. Two items need a quick check before the next payroll run.",
  facts: [
    {
      topic: "Headcount",
      statement: "De Kroon now has 57 employees.",
      sourceIds: ["S1", "S2"],
      recommendedSourceId: "S2",
      why: "The client's own email from August 2026 is more recent than the handover note from June 2025.",
      conflict: true,
      conflictSummary: "Handover note (Jun 2025) says 48 employees, client email (Aug 2026) says 57.",
      askPerson: "Client HR",
      impact:
        "At 50+ employees the 2026 solidarity contribution applies: 30% of sickness benefit in months 2–3 of illness.",
    },
    {
      topic: "Payroll cut-off",
      statement: "Payroll cut-off is probably the 18th of the month since April 2026.",
      sourceIds: ["S1", "S3"],
      recommendedSourceId: "S3",
      why: "The Teams message is more recent, but it is informal and the handover note was never updated.",
      conflict: true,
      conflictSummary: "Handover note says the 20th, Jan's Teams message (Mar 2026) says the 18th.",
      askPerson: "Jan Peeters",
      impact: "A wrong cut-off date means late changes are missed in the monthly payroll.",
    },
    {
      topic: "Sick leave relapse period",
      statement: "A relapse within 8 weeks after returning to work does not start a new guaranteed wage period.",
      sourceIds: ["S4", "S5"],
      recommendedSourceId: "S5",
      why: "The legal memo is verified by an expert and reflects the 2026 reform. The Confluence page is from 2024 and has no owner.",
      conflict: false,
      conflictSummary: "",
      askPerson: "Sofie Claes",
      impact: "The Confluence page (14 days) is outdated and should be updated or archived.",
    },
    {
      topic: "Overtime",
      statement: "Overtime above 38 hours per week is paid at 150% (company CAO).",
      sourceIds: ["S6", "S7"],
      recommendedSourceId: "S6",
      why: "The company CAO summary is client-specific. The 125% template is written for the Netherlands and does not apply.",
      conflict: false,
      conflictSummary: "",
      askPerson: "Client HR",
      impact: "The CAO summary is from 2023 and its owner has left, so confirm it is still current.",
    },
  ],
};
