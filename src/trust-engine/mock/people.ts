import type { Client, Fact, Person } from "../types";

export const people: Person[] = [
  { id: "anna", name: "Anna De Smet", role: "expert", team: "Payroll BE" },
  { id: "jan", name: "Jan Wouters", role: "expert", team: "Payroll BE" },
  { id: "an", name: "An Peeters", role: "expert", team: "Legal Payroll BE" },
  { id: "lotte", name: "Lotte Verbeke", role: "expert", team: "Payroll BE" },
  { id: "sofie", name: "Sofie Maes", role: "regular", team: "Payroll BE" },
  { id: "pieter", name: "Pieter Jacobs", role: "regular", team: "Payroll BE" },
  { id: "koen", name: "Koen Maes", role: "regular", team: "Payroll BE", left: true },
  { id: "tom", name: "Tom Claes", role: "new", team: "Payroll BE" },
  { id: "lars", name: "Lars de Vries", role: "expert", team: "Payroll NL" },
  { id: "sanne", name: "Sanne de Vries", role: "expert", team: "Legal Payroll NL" },
  { id: "emma", name: "Emma Bakker", role: "regular", team: "Payroll NL" },
  { id: "guest", name: "Guest", role: "regular", team: "Demo visitor" },
];

export const clients: Client[] = [
  { id: "brouwerij-de-kroon", name: "Brouwerij De Kroon NV", country: "BE", pc: "200" },
  { id: "techstart-gent", name: "TechStart Gent BV", country: "BE", pc: "200" },
  { id: "bakkerij-janssens", name: "Bakkerij Janssens", country: "BE", pc: "118" },
  { id: "groen-bv", name: "Groen BV", country: "NL" },
];

export const facts: Fact[] = [
  { key: "indexation-2026", label: "Wage indexation January 2026", topic: "indexation", keywords: ["index", "indexering", "indexatie"] },
  { key: "sick-relapse", label: "Relapse period for guaranteed salary", topic: "sick-leave", keywords: ["relapse", "sick", "guaranteed salary", "illness", "ziek"] },
  { key: "meal-voucher-max", label: "Max employer part of a meal voucher", topic: "meal-vouchers", keywords: ["meal voucher", "meal-voucher", "maaltijdcheque", "meal"] },
  { key: "overtime-recovery", label: "Deadline to take overtime recovery rest", topic: "working-time", keywords: ["overtime", "overuren", "recovery", "inhaalrust"] },
  { key: "holiday-pay", label: "Holiday pay", topic: "holiday-pay", keywords: ["holiday pay", "holiday allowance", "vakantiegeld", "vacation pay", "double holiday"] },
  { key: "end-of-year-bonus", label: "End-of-year bonus payment month", topic: "bonus", keywords: ["end-of-year", "end of year", "13th month", "year-end", "eindejaarspremie", "bonus"] },
  { key: "flexi-job", label: "Flexi-jobs allowed", topic: "working-time", keywords: ["flexi"] },
];
