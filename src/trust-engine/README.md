# Trust engine

Deterministic trust scoring for scattered HR/payroll knowledge. No framework imports and no AI in the scoring:
the same input always gives the same score, and every point is explained.

## How a score is built

Every claim (one statement from one source) starts at 50%. Six layers add or subtract points (log-odds), then hard caps apply.

| Layer | Question | Examples |
|---|---|---|
| 1 Authority | Who said it? | Official +3, expert +1, new hire −0.5 |
| 2 Freshness | When? | −1 per topic half-life (max −2), written before the rule change −2.5 |
| 3 Corroboration | Who agrees? | Expert 👍 +0.5, colleague says the same +0.7, corrected in a reply −1.5 |
| 4 Consistency | Does it match the official source? | Match +2, contradicts −3 |
| 5 Relevance | Does it apply to my case? | Client +1.5, sector (PC) +1, country +0.3. Other country/sector/client is excluded |
| 6 Feedback | Did it work for people who used it? | Weighted by voter role, capped at ±2. Votes can't sink an official source |

Caps: contradicts official → max 20%, predates the rule → max 30%, no expert or official backing → max 60%.
"Doesn't apply to my case" votes teach scope: after 3 from the same country and sector, the claim is hidden there.

Fact status: **trusted** (best ≥ 75%), **conflict** (two different values ≥ 50% at the same specificity),
**stale** (best < 75%), **orphan** (no expert or official source behind it).

All weights are in [`config.ts`](config.ts).

## Files

- `types.ts`: data shapes (Claim, Fact, Context, Feedback…)
- `config.ts`: all weights, caps, half-lives
- `scope.ts`: country / sector / client matching
- `score.ts`: `evaluateFact()` runs the six layers
- `ask.ts`: `ask()` matches a question to a fact (keywords for now, swap for an LLM later)
- `feedback.ts`: input validation and `FeedbackStore` (in-memory now, swap for Firestore later)
- `mock/`: fake data from four sources: official, Teams, SharePoint, email

## Use it

```ts
import { ask, evaluateFact, mockKnowledgeBase, MOCK_NOW } from "@/trust-engine";

ask("What is the indexation?", { country: "BE", pc: "200" }, mockKnowledgeBase, [], MOCK_NOW);
```

HTTP (Next.js routes in `src/app/api/trust/`):

- `POST /api/trust/ask` `{ question, context: { country, pc } | { client } }`
- `GET /api/trust/facts?country=BE&pc=200`: every fact with status, for the brain map
- `POST /api/trust/feedback` `{ claimId, kind, context }`, header `x-demo-user` (**demo only, replace with real auth**)
- `GET /api/trust/meta`: people, clients, facts

Try it at <http://localhost:3000/chat>. Run the tests with `npm test`.

## Not done yet

- Layer 0: LLM extraction of claims from real Teams exports and documents (claims are hand-written mock data)
- Real login: the `x-demo-user` header is spoofable
- Persistent feedback: the in-memory store resets on restart
- Author track record computed from history instead of a fixed role
