// Every tunable number lives here. Points are log-odds: 0 = 50%, +2 ≈ 88%, -2 ≈ 12%.

export const POINTS = {
  // Layer 1 – authority: who said it?
  official: 3.0,
  expertAuthor: 1.0,
  newAuthor: -0.5,
  // Layer 2 – freshness: when?
  maxAgePenalty: 2.0, // -1 point per topic half-life, capped here
  predatesRuleChange: -2.5,
  // Layer 3 – corroboration: who agrees?
  expertReaction: 0.5,
  maxExpertReactions: 3,
  agreement: 0.7,
  maxAgreements: 2,
  corrected: -1.5,
  // Layer 4 – consistency with the official source
  matchesOfficial: 2.0,
  contradictsOfficial: -3.0,
  // Layer 5 – relevance: how specific is it to the asker's case?
  relevance: { client: 1.5, sector: 1.0, country: 0.3 },
  // Layer 6 – usage feedback
  feedbackCap: 2.0,
  outdatedVote: -0.5,
  voterWeight: { expert: 1.5, regular: 1.0, new: 0.5 },
} as const;

// Hard ceilings that override the sum.
export const CAPS = {
  contradictsOfficial: 0.2,
  predatesRuleChange: 0.3,
  noExpertBacking: 0.6,
} as const;

// How fast knowledge on a topic goes stale.
export const HALF_LIFE_DAYS: Record<string, number> = {
  indexation: 180,
  "sick-leave": 365,
  "meal-vouchers": 365,
  "working-time": 730,
  "holiday-pay": 730,
  bonus: 365,
};
export const DEFAULT_HALF_LIFE_DAYS = 365;

// "Doesn't apply to my case" votes from the same country+sector before a claim is hidden there.
export const NOT_APPLICABLE_THRESHOLD = 3;

export const STATUS = { trusted: 0.75, usable: 0.5 } as const;
