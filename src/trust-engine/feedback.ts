import type { Context, Feedback, FeedbackKind, KnowledgeBase } from "./types";

// Storage is behind an interface so the in-memory version can be swapped for Firestore later.
export interface FeedbackStore {
  all(): Feedback[];
  put(f: Feedback): void;
}

export class MemoryFeedbackStore implements FeedbackStore {
  private votes = new Map<string, Feedback>();
  all() {
    return [...this.votes.values()];
  }
  // One vote per user per claim: a new vote replaces the old one.
  put(f: Feedback) {
    this.votes.set(`${f.userId}:${f.claimId}`, f);
  }
}

const KINDS: FeedbackKind[] = ["correct", "wrong", "outdated", "not_applicable"];

// Validates untrusted input. userId must come from the authenticated session, never from the request body.
export function parseFeedback(
  input: unknown,
  userId: string,
  kb: KnowledgeBase,
  now = new Date(),
): { ok: true; feedback: Feedback } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Body must be an object" };
  const { claimId, kind, context } = input as Record<string, unknown>;
  if (!kb.people.some((p) => p.id === userId)) return { ok: false, error: "Unknown user" };
  if (typeof claimId !== "string" || !kb.claims.some((c) => c.id === claimId)) return { ok: false, error: "Unknown claim" };
  if (typeof kind !== "string" || !KINDS.includes(kind as FeedbackKind)) return { ok: false, error: "Invalid kind" };
  const ctx = parseContext(context, kb);
  if (!ctx) return { ok: false, error: "Invalid context" };
  return { ok: true, feedback: { claimId, userId, kind: kind as FeedbackKind, context: ctx, date: now.toISOString() } };
}

// A client id wins over free-text country/sector, so a case cannot claim a scope it does not have.
export function parseContext(input: unknown, kb: KnowledgeBase): Context | null {
  if (!input || typeof input !== "object") return null;
  const { country, pc, client } = input as Record<string, unknown>;
  if (typeof client === "string" && client) {
    const c = kb.clients.find((x) => x.id === client);
    return c ? { country: c.country, pc: c.pc, client: c.id } : null;
  }
  if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return null;
  if (pc !== undefined && pc !== "" && (typeof pc !== "string" || !/^\d{3}$/.test(pc))) return null;
  return { country, pc: typeof pc === "string" && pc ? pc : undefined };
}
