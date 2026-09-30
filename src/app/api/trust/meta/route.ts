import { kb } from "@/lib/trust-server";

// GET -> people, clients and facts, for dropdowns in the UI
export async function GET() {
  return Response.json({
    people: kb.people.map(({ id, name, role }) => ({ id, name, role })),
    clients: kb.clients,
    facts: kb.facts.map(({ key, label }) => ({ key, label })),
  });
}
