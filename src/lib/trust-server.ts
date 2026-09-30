import { MemoryFeedbackStore, MOCK_NOW, type KnowledgeBase, type Person } from "@/trust-engine";
import { loadDataKnowledgeBase } from "@/trust-engine/data";
import { readCookie, SESSION_COOKIE, verifySession } from "@/lib/auth";

// Server-side wiring for the trust engine. Swap these three for real data, Firestore and a real clock later.
// Knowledge comes from the source files in data/salary (mock claims fill topics without files yet).
const data = loadDataKnowledgeBase();
export const kb: KnowledgeBase = data.kb;
export const testQuestions = data.testQuestions;
export const feedbackStore = new MemoryFeedbackStore();
export const now = () => MOCK_NOW;

// The signed-in user, from the signed session cookie. Identity never comes from the request body or headers.
export function currentUser(request: Request): Person | null {
  const id = verifySession(readCookie(request, SESSION_COOKIE));
  return (id && kb.people.find((p) => p.id === id && !p.left)) || null;
}

export const unauthorized = () => Response.json({ error: "not signed in" }, { status: 401 });
export const forbidden = () => Response.json({ error: "cross-site request refused" }, { status: 403 });

export const tooManyRequests = () => Response.json({ error: "too many requests, try again in a minute" }, { status: 429 });

// Bodies are small JSON objects. The limit is checked on the bytes actually read, not only on the header.
const MAX_BODY_BYTES = 10_000;

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}
