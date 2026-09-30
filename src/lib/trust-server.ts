import { MOCK_NOW, type Feedback, type KnowledgeBase, type Person } from "@/trust-engine";
import { loadDataKnowledgeBase } from "@/trust-engine/data";
import { activeSession, readCookie, SESSION_COOKIE, type Session } from "@/lib/auth";
import { store } from "@/lib/store";

// Server-side wiring for the trust engine. Swap these for real data and a real clock later.
// Knowledge comes from the source files in data/salary (mock claims fill topics without files yet).
const data = loadDataKnowledgeBase();
export const kb: KnowledgeBase = data.kb;
export const testQuestions = data.testQuestions;
export const now = () => MOCK_NOW;

// Votes live in the shared store: one vote per user per claim (a new vote replaces the old one).
export async function allFeedback(): Promise<Feedback[]> {
  return (await store.hvals("votes")).map((v) => JSON.parse(v) as Feedback);
}
export async function saveFeedback(f: Feedback) {
  await store.hset("votes", `${f.userId}:${f.claimId}`, JSON.stringify(f));
}

// The signed-in user, from the signed session cookie. Identity never comes from the request body or headers.
export async function currentSession(request: Request): Promise<{ user: Person; session: Session } | null> {
  const session = await activeSession(readCookie(request, SESSION_COOKIE));
  const user = session && kb.people.find((p) => p.id === session.sub && !p.left);
  return user && session ? { user, session } : null;
}

export const currentUser = async (request: Request) => (await currentSession(request))?.user ?? null;

export const unauthorized = () => Response.json({ error: "not signed in" }, { status: 401 });
export const forbidden = () => Response.json({ error: "cross-site request refused" }, { status: 403 });
export const notYourClient = () => Response.json({ error: "you do not have access to this client or country" }, { status: 403 });
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
