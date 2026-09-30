import { readSource } from "@/trust-engine/data";
import { currentUser, kb, unauthorized } from "@/lib/trust-server";

// GET ?id=<claim id> -> the document behind a claim. Only known claim ids, never a file path from the request.
export async function GET(request: Request) {
  if (!currentUser(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  const claim = kb.claims.find((c) => c.id === id);
  if (!claim) return Response.json({ error: "unknown source" }, { status: 404 });
  return Response.json(readSource(claim));
}
