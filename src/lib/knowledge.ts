// Demo knowledge base: every source an SD Worx consultant could hit for one customer question.

export type Source = {
  id: string;
  title: string;
  short: string;
  channel: "Policy" | "PDF manual" | "Confluence" | "Teams" | "Newsletter" | "Email";
  date: string; // last updated, ISO
  owner: string | null;
  ownerActive: boolean;
  verifiedBy: string | null;
  country: "BE" | "NL";
  status: "final" | "draft";
  text: string;
};

export const customer = {
  company: "Brouwerij De Kroon NV",
  contact: "HR manager",
  country: "BE",
  employees: 80,
  question:
    "One of our white-collar employees (42) was on sick leave for 5 weeks, came back for 3 weeks, and is now sick again. Do we pay guaranteed salary from day 1 again? And does the new solidarity contribution apply to us?",
};

export const today = "2026-09-30";

export const sources: Source[] = [
  {
    id: "policy-2026",
    title: "Sick leave & guaranteed salary – Belgium 2026",
    short: "BE policy 2026",
    channel: "Policy",
    date: "2026-02-12",
    owner: "An Peeters",
    ownerActive: true,
    verifiedBy: "Legal Payroll BE",
    country: "BE",
    status: "final",
    text: `From 1 January 2026 the relapse period for white-collar employees is extended from 14 days to 8 weeks. If an employee falls ill again within 8 weeks after returning to work, it counts as the same illness: the guaranteed salary is not restarted and continues where it stopped. Once 30 days of guaranteed salary have been paid, the health insurance fund (mutualiteit) takes over.
Solidarity contribution: employers with 50 or more employees pay 30% of the sickness benefit for the 2nd and 3rd month of incapacity, for employees under 55. First collection in Q4 2026.`,
  },
  {
    id: "manual-2023",
    title: "Payroll manual Belgium v4",
    short: "Manual v4 (2023)",
    channel: "PDF manual",
    date: "2023-03-08",
    owner: "Koen Maes",
    ownerActive: false,
    verifiedBy: null,
    country: "BE",
    status: "final",
    text: `Relapse rule: when a white-collar employee falls ill again more than 14 days after returning to work, a new period of guaranteed salary starts (30 days paid by the employer). Within 14 days, the guaranteed salary continues.`,
  },
  {
    id: "nl-guide",
    title: "Ziekteverzuim & loondoorbetaling – Nederland",
    short: "NL sick pay guide",
    channel: "Confluence",
    date: "2025-11-20",
    owner: "Sanne de Vries",
    ownerActive: true,
    verifiedBy: "Legal Payroll NL",
    country: "NL",
    status: "final",
    text: `The employer continues to pay at least 70% of salary for up to 104 weeks of illness. Periods of illness that follow each other within 4 weeks are added together.`,
  },
  {
    id: "teams-tom",
    title: "Teams #payroll-be – message from Tom Claes",
    short: "Teams message",
    channel: "Teams",
    date: "2026-08-14",
    owner: "Tom Claes",
    ownerActive: true,
    verifiedBy: null,
    country: "BE",
    status: "final",
    text: `relapse is still 14 days for white-collar, I checked last year. after that it's a new guaranteed salary period`,
  },
  {
    id: "faq-solidarity",
    title: "Client newsletter – the new solidarity contribution",
    short: "Client newsletter",
    channel: "Newsletter",
    date: "2026-01-05",
    owner: "SD Worx Communications",
    ownerActive: true,
    verifiedBy: "Legal Payroll BE",
    country: "BE",
    status: "final",
    text: `From 2026, employers with at least 50 employees contribute 30% of the sickness benefit during the 2nd and 3rd month of an employee's incapacity (employees under 55). The first invoices are expected in Q4 2026.`,
  },
  {
    id: "draft-email",
    title: "Email from Legal – reform draft (not final)",
    short: "Draft email",
    channel: "Email",
    date: "2025-10-02",
    owner: "An Peeters",
    ownerActive: true,
    verifiedBy: null,
    country: "BE",
    status: "draft",
    text: `DRAFT – not voted yet. The government plans to extend the relapse period to 4 weeks, possibly more. Do not communicate to clients before the law is published.`,
  },
];

export const experts = {
  "An Peeters": "Legal Payroll BE – owns the Belgian sick leave policy",
  "Sanne de Vries": "Legal Payroll NL",
  "Tom Claes": "Payroll consultant BE",
};
