import { readSource } from "@/trust-engine/data";
import { currentUser, kb, notYourClient, unauthorized } from "@/lib/trust-server";
import { canReadClaim } from "@/lib/access";

// GET ?id=<claim id> -> the document behind a claim. Only known claim ids, never a file path from the request.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  const claim = kb.claims.find((c) => c.id === id);
  if (!claim) return Response.json({ error: "unknown source" }, { status: 404 });
  if (!canReadClaim(user, claim, kb)) return notYourClient();
  return Response.json(readSource(claim));
}
