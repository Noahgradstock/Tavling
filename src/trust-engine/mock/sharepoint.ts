import type { Claim } from "../types";

// Documents on SharePoint: manuals, guides, drafts.
const doc = (title: string) => ({ type: "sharepoint" as const, title });

export const sharepoint: Claim[] = [
  { id: "sp-idx-draft", factKey: "indexation-2026", value: "2.1%", scope: { country: "BE", pc: "200" }, source: doc("Indexation guide 2026 (draft estimate)"), author: "pieter", date: "2025-11-15", text: "Expected indexation PC 200 in January 2026: 2.1% (estimate)." },
  { id: "sp-manual-relapse", factKey: "sick-relapse", value: "14 days", scope: { country: "BE" }, source: doc("Payroll manual Belgium v4"), author: "koen", date: "2023-03-08", text: "A new guaranteed salary period starts when the employee falls ill again more than 14 days after returning." },
  { id: "sp-manual-meal", factKey: "meal-voucher-max", value: "€6.91", scope: { country: "BE" }, source: doc("Payroll manual Belgium v4 – benefits annex"), author: "koen", date: "2024-02-01", text: "Employer part of a meal voucher: max €6.91." },
  { id: "sp-nl-relapse", factKey: "sick-relapse", value: "4 weeks", scope: { country: "NL" }, source: doc("Ziekteverzuim & loondoorbetaling – NL"), author: "sanne", date: "2025-11-20", text: "Illness periods that follow each other within 4 weeks are added together." },
  { id: "sp-flexi-old", factKey: "flexi-job", value: "not allowed", scope: { country: "BE" }, source: doc("Flexi-jobs FAQ 2022"), author: "koen", date: "2022-06-01", text: "Flexi-jobs are only allowed in hospitality and retail." },
];
