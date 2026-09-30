import { NOT_APPLICABLE_THRESHOLD } from "./config";
import type { Claim, Context, Feedback, Relevance } from "./types";

export type ScopeMatch = { ok: true; relevance: Relevance } | { ok: false; reason: string };

// A claim applies when every part of its scope that is set matches the asker's case.
// A mismatch does not make a claim less true, it makes it not apply.
export function matchScope(claim: Claim, ctx: Context, feedback: Feedback[] = []): ScopeMatch {
  const { scope } = claim;
  if (scope.country !== ctx.country) return { ok: false, reason: `Applies to ${scope.country}, not ${ctx.country}` };
  if (scope.pc && ctx.pc && scope.pc !== ctx.pc) return { ok: false, reason: `Applies to PC ${scope.pc}, not PC ${ctx.pc}` };
  if (scope.client && scope.client !== ctx.client) return { ok: false, reason: `Specific to another client (${scope.client})` };

  // Learned scope: enough people in this country+sector said "doesn't apply to my case".
  const votes = feedback.filter(
    (f) => f.claimId === claim.id && f.kind === "not_applicable" && f.context.country === ctx.country && f.context.pc === ctx.pc,
  ).length;
  if (votes >= NOT_APPLICABLE_THRESHOLD) {
    return { ok: false, reason: `${votes} consultants reported it does not apply to ${ctx.country}${ctx.pc ? ` PC ${ctx.pc}` : ""}` };
  }

  return { ok: true, relevance: scope.client ? "client" : scope.pc ? "sector" : "country" };
}
