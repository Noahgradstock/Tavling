import { currentUser, kb, testQuestions, unauthorized } from "@/lib/trust-server";
import { clientsOf, countriesOf } from "@/lib/access";

// GET -> people, the clients and countries this user works on, facts and the example questions they may ask
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const clients = clientsOf(user, kb);
  const countries = countriesOf(user);
  const allowed = (ctx: { client?: string; country?: string }) =>
    ctx.client ? clients.some((c) => c.id === ctx.client) : !!ctx.country && countries.includes(ctx.country);
  return Response.json({
    people: kb.people.map(({ id, name, role }) => ({ id, name, role })),
    clients,
    countries,
    facts: kb.facts.map(({ key, label }) => ({ key, label })),
    examples: testQuestions.filter((q) => allowed(q.context)),
  });
}
