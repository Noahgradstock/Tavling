import type { Claim } from "../types";

// Messages from Teams channels #payroll-be and #payroll-nl.
const be = { type: "teams" as const, title: "Teams #payroll-be" };
const nl = { type: "teams" as const, title: "Teams #payroll-nl" };

export const teams: Claim[] = [
  // Indexation: an early guess spreads, an expert corrects it after the official notice.
  { id: "tm-idx-tom", factKey: "indexation-2026", value: "2.1%", scope: { country: "BE", pc: "200" }, source: be, author: "tom", date: "2025-12-10", text: "I think indexation for PC 200 will be 2.1% in January" },
  { id: "tm-idx-anna", factKey: "indexation-2026", value: "1.8%", scope: { country: "BE", pc: "200" }, source: be, author: "anna", date: "2026-01-05", text: "Official notice is out: PC 200 indexation is 1.8%, not 2.1%.", reactions: ["jan", "lotte", "sofie"] },
  { id: "tm-idx-sofie", factKey: "indexation-2026", value: "2.1%", scope: { country: "BE", pc: "200" }, source: be, author: "sofie", date: "2026-01-06", text: "pretty sure we used 2.1% in the last run for PC 200?" },
  { id: "tm-idx-anna2", factKey: "indexation-2026", value: "1.8%", scope: { country: "BE", pc: "200" }, source: be, author: "anna", date: "2026-01-06", text: "@Sofie that was the draft estimate. It's 1.8%.", corrects: "tm-idx-sofie" },
  { id: "tm-idx-nl", factKey: "indexation-2026", value: "none (CAO)", scope: { country: "NL" }, source: nl, author: "lars", date: "2026-01-10", text: "NL has no automatic indexation, increases come from the CAO." },

  // Sick leave relapse: old rule still circulating.
  { id: "tm-relapse-tom", factKey: "sick-relapse", value: "14 days", scope: { country: "BE" }, source: be, author: "tom", date: "2026-08-14", text: "relapse is still 14 days for white-collar, I checked last year" },
  { id: "tm-relapse-an", factKey: "sick-relapse", value: "8 weeks", scope: { country: "BE" }, source: be, author: "an", date: "2026-02-12", text: "Reminder: relapse period is 8 weeks since 1 January.", reactions: ["anna"] },

  // Meal vouchers
  { id: "tm-meal-jan", factKey: "meal-voucher-max", value: "€8.91", scope: { country: "BE" }, source: be, author: "jan", date: "2026-01-12", text: "Meal voucher employer part is €8.91 from this year.", reactions: ["anna"] },
  { id: "tm-meal-pieter", factKey: "meal-voucher-max", value: "€6.91", scope: { country: "BE" }, source: be, author: "pieter", date: "2026-03-03", text: "max employer part meal voucher = 6.91 right?" },
  { id: "tm-meal-anna", factKey: "meal-voucher-max", value: "€8.91", scope: { country: "BE" }, source: be, author: "anna", date: "2026-03-03", text: "@Pieter it went up to €8.91 in January.", corrects: "tm-meal-pieter" },

  // Overtime: two experts disagree and there is no official source in the brain.
  { id: "tm-ot-anna", factKey: "overtime-recovery", value: "3 months", scope: { country: "BE", pc: "200" }, source: be, author: "anna", date: "2026-05-12", text: "Overtime recovery rest must be taken within 3 months.", reactions: ["lotte"] },
  { id: "tm-ot-jan", factKey: "overtime-recovery", value: "4 months", scope: { country: "BE", pc: "200" }, source: be, author: "jan", date: "2026-06-02", text: "For PC 200 it's 4 months to take the recovery rest.", reactions: ["an"] },

  // Holiday pay: NL rule leaking into BE.
  { id: "tm-hol-tom", factKey: "holiday-pay", value: "8%", scope: { country: "BE" }, source: be, author: "tom", date: "2026-04-02", text: "holiday allowance is 8% of annual salary" },
  { id: "tm-hol-emma", factKey: "holiday-pay", value: "8%", scope: { country: "NL" }, source: nl, author: "emma", date: "2026-02-10", text: "Vakantiegeld is 8%, paid in May." },

  // End-of-year bonus
  { id: "tm-eoy-sofie", factKey: "end-of-year-bonus", value: "December", scope: { country: "BE", pc: "200" }, source: be, author: "sofie", date: "2025-11-20", text: "End-of-year bonus PC 200 goes out with the December payroll.", reactions: ["anna"] },

  // Flexi-jobs: nobody who knows has said anything.
  { id: "tm-flexi-pieter", factKey: "flexi-job", value: "allowed", scope: { country: "BE", pc: "200" }, source: be, author: "pieter", date: "2025-03-18", text: "flexi-jobs are allowed in PC 200 since 2024 I think" },
];
