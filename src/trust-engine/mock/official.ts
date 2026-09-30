import type { Claim } from "../types";

// Official publications (law, sector agreements). Mock values, not real legal advice.
const src = (title: string) => ({ type: "official" as const, title });

export const official: Claim[] = [
  { id: "off-idx-200", factKey: "indexation-2026", value: "1.8%", scope: { country: "BE", pc: "200" }, source: src("Official notice: PC 200 indexation 2026"), author: null, date: "2025-12-19", effectiveFrom: "2026-01-01", text: "Wages in joint committee 200 are indexed by 1.8% on 1 January 2026." },
  { id: "off-idx-118", factKey: "indexation-2026", value: "2.0%", scope: { country: "BE", pc: "118" }, source: src("Official notice: PC 118 indexation 2026"), author: null, date: "2025-12-19", effectiveFrom: "2026-01-01", text: "Wages in joint committee 118 are indexed by 2.0% on 1 January 2026." },
  { id: "off-relapse-2026", factKey: "sick-relapse", value: "8 weeks", scope: { country: "BE" }, source: src("Law: relapse period white-collar 2026"), author: null, date: "2025-12-22", effectiveFrom: "2026-01-01", text: "From 1 January 2026 a new illness within 8 weeks after returning to work counts as the same illness. No new guaranteed salary period starts." },
  { id: "off-meal-2024", factKey: "meal-voucher-max", value: "€6.91", scope: { country: "BE" }, source: src("Royal decree: meal vouchers 2024"), author: null, date: "2023-12-15", effectiveFrom: "2024-01-01", text: "The employer part of a meal voucher is capped at €6.91." },
  { id: "off-meal-2026", factKey: "meal-voucher-max", value: "€8.91", scope: { country: "BE" }, source: src("Royal decree: meal vouchers 2026"), author: null, date: "2025-12-18", effectiveFrom: "2026-01-01", text: "From 1 January 2026 the employer part of a meal voucher is capped at €8.91." },
  { id: "off-hol-be", factKey: "holiday-pay", value: "92%", scope: { country: "BE" }, source: src("Law: annual holidays (BE)"), author: null, date: "2019-01-01", effectiveFrom: "2019-01-01", text: "White-collar double holiday pay is 92% of the monthly salary." },
  { id: "off-hol-nl", factKey: "holiday-pay", value: "8%", scope: { country: "NL" }, source: src("Law: vakantiebijslag (NL)"), author: null, date: "2019-01-01", effectiveFrom: "2019-01-01", text: "Holiday allowance is at least 8% of the annual salary." },
];
