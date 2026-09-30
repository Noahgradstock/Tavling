import type { Claim } from "../types";

// Emails: client-specific agreements and drafts from Legal.
const mail = (title: string) => ({ type: "email" as const, title });

export const email: Claim[] = [
  { id: "em-idx-janssens", factKey: "indexation-2026", value: "2.0%", scope: { country: "BE", pc: "118", client: "bakkerij-janssens" }, source: mail("Email: Bakkerij Janssens indexation"), author: "jan", date: "2026-01-20", text: "For Bakkerij Janssens we apply the 2.0% from 1 February, per their company agreement." },
  { id: "em-relapse-draft", factKey: "sick-relapse", value: "4 weeks", scope: { country: "BE" }, source: mail("Email from Legal: reform draft (not final)"), author: "an", date: "2025-10-02", text: "DRAFT: the government plans to extend the relapse period to 4 weeks, possibly more. Do not share with clients." },
  { id: "em-eoy-techstart", factKey: "end-of-year-bonus", value: "November", scope: { country: "BE", pc: "200", client: "techstart-gent" }, source: mail("Email: TechStart Gent payroll agreement"), author: "jan", date: "2025-10-14", text: "TechStart Gent pays the end-of-year bonus with the November payroll (company agreement)." },
];
