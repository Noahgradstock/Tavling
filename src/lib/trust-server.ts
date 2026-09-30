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

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}
