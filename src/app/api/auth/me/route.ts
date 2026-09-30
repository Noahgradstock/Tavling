import { currentUser, unauthorized } from "@/lib/trust-server";

// GET -> the signed-in user
export async function GET(request: Request) {
  const user = currentUser(request);
  if (!user) return unauthorized();
  return Response.json({ user: { id: user.id, name: user.name, role: user.role, team: user.team } });
}
