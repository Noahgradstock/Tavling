import type { Claim, Client, Context, KnowledgeBase, Person } from "@/trust-engine";

// Which clients a consultant may work on. In production this comes from SD Worx's client portfolio system;
// here it is a fixed demo portfolio. Experts see every client in their country, others only their own portfolio.
const PORTFOLIO: Record<string, string[]> = {
  sofie: ["brouwerij-de-kroon", "techstart-gent", "bakkerij-janssens"],
  pieter: ["techstart-gent", "hotel-ter-duinen", "bouwbedrijf-vermeulen"],
  tom: ["brouwerij-de-kroon"],
  emma: ["groen-bv"],
};

// Countries come from the team name, e.g. "Payroll BE" or "Legal Payroll NL".
export const countriesOf = (user: Person): string[] => user.team.match(/\b[A-Z]{2}\b/g) ?? [];

export function clientsOf(user: Person, kb: KnowledgeBase): Client[] {
  const countries = countriesOf(user);
  const own = new Set(PORTFOLIO[user.id] ?? []);
  return kb.clients.filter((c) => countries.includes(c.country) && (user.role === "expert" || own.has(c.id)));
}

// A case (client, or country + sector) the user may ask about or vote in.
export function canUseContext(user: Person, ctx: Context, kb: KnowledgeBase): boolean {
  if (ctx.client) return clientsOf(user, kb).some((c) => c.id === ctx.client);
  return countriesOf(user).includes(ctx.country);
}

// Client-specific sources (company agreements, client emails) only for consultants of that client.
export function canReadClaim(user: Person, claim: Claim, kb: KnowledgeBase): boolean {
  return !claim.scope.client || clientsOf(user, kb).some((c) => c.id === claim.scope.client);
}
