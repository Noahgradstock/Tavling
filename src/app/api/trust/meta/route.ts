import { currentUser, kb, testQuestions, unauthorized } from "@/lib/trust-server";

// GET -> people, clients, facts and the example questions from the test data, for the UI
export async function GET(request: Request) {
  if (!currentUser(request)) return unauthorized();
  return Response.json({
    people: kb.people.map(({ id, name, role }) => ({ id, name, role })),
    clients: kb.clients,
    facts: kb.facts.map(({ key, label }) => ({ key, label })),
    examples: testQuestions,
  });
}
