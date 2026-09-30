// Shared types for the trust engine. No framework imports: this module runs anywhere
// (Next.js route, Cloud Run service, tests).

export type SourceType = "official" | "sharepoint" | "teams" | "email";
export type Role = "expert" | "regular" | "new";

// Where a piece of knowledge applies. Missing pc/client = applies to the whole country.
export type Scope = { country: string; pc?: string; client?: string };

// Who is asking: the consultant's current case.
export type Context = { country: string; pc?: string; client?: string };

export type Person = { id: string; name: string; role: Role; team: string };

export type Client = { id: string; name: string; country: string; pc?: string };

// One question the brain can answer, e.g. "indexation in January 2026".
// Claims from any source and any scope hang under it.
export type Fact = { key: string; label: string; topic: string; keywords: string[] };

// One statement pulled out of one source. In production an LLM extracts these (layer 0);
// here they come from mock data.
export type Claim = {
  id: string;
  factKey: string;
  value: string;
  scope: Scope;
  source: { type: SourceType; title: string };
  author: string | null; // person id, null for official publications
  date: string; // ISO date the claim was written
  effectiveFrom?: string; // official claims: when the rule takes effect
  text: string;
  reactions?: string[]; // person ids who gave a thumbs-up
  corrects?: string; // id of the claim this one replies to and corrects
};

export type FeedbackKind = "correct" | "wrong" | "outdated" | "not_applicable";

export type Feedback = { claimId: string; userId: string; kind: FeedbackKind; context: Context; date: string };

export type KnowledgeBase = { facts: Fact[]; claims: Claim[]; people: Person[]; clients: Client[] };

export type Relevance = "client" | "sector" | "country";

export type Evidence = { layer: string; label: string; points: number };

export type ScoredClaim = {
  claim: Claim;
  score: number; // 0..1
  relevance: Relevance;
  evidence: Evidence[];
  caps: string[];
};

export type FactStatus = "trusted" | "conflict" | "stale" | "orphan";

export type FactResult = {
  fact: Fact;
  status: FactStatus;
  best: ScoredClaim | null;
  claims: ScoredClaim[]; // relevant claims, best first
  excluded: { claim: Claim; reason: string }[]; // other country/sector/client
};
