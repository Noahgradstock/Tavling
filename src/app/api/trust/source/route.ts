import { readFile } from "node:fs/promises";
import path from "node:path";
import { kb } from "@/lib/trust-server";

const ROOT = path.join(process.cwd(), "data", "salary");

// GET ?claim=<id> -> the full source file behind one claim.
// Only files referenced by a known claim can be read, so no path from the client ever reaches the filesystem.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("claim");
  const file = kb.claims.find((c) => c.id === id)?.file;
  if (!file) return Response.json({ error: "unknown claim" }, { status: 404 });
  const full = path.resolve(ROOT, file);
  if (!full.startsWith(ROOT + path.sep)) return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    return Response.json({ file, text: (await readFile(full, "utf8")).slice(0, 20_000) });
  } catch {
    return Response.json({ error: "file not found" }, { status: 404 });
  }
}
