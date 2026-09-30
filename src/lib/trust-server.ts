import { MemoryFeedbackStore, MOCK_NOW, mockKnowledgeBase, type KnowledgeBase } from "@/trust-engine";

// Server-side wiring for the trust engine. Swap these three for real data, Firestore and a real clock later.
export const kb: KnowledgeBase = mockKnowledgeBase;
export const feedbackStore = new MemoryFeedbackStore();
export const now = () => MOCK_NOW;

// DEMO ONLY: identity comes from a header the chat sets. Replace with the real session
// (e.g. Google IAP / NextAuth) before this goes anywhere near real data.
export function currentUser(request: Request): string | null {
  const id = request.headers.get("x-demo-user");
  return id && kb.people.some((p) => p.id === id) ? id : null;
}

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}
