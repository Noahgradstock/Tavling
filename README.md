# Company brain: trusted answers

Team Aleida.ai · Tectonic Hackathon 2026 · SD Worx challenge "Unlock the Knowledge Within"

A payroll consultant gets an urgent customer question. The answer exists, but it is spread across a policy, an old manual, a Dutch guide, a Teams thread, a newsletter and a draft email, and they disagree. This proof of concept answers the question **and shows why each source can or cannot be trusted**, so the consultant goes from "I found something" to "I understand why I can rely on it".

## What it does

1. **Ask.** Type a question in any language, or pick one of the examples (sick leave relapse, indexation 2026, meal vouchers, end-of-year bonus, holiday pay).
2. **Search.** Every source that mentions the topic is collected: official law, SharePoint, Teams, email.
3. **Score.** A deterministic trust engine scores every claim through six visible layers: authority, freshness, corroboration, consistency with the official source, relevance to this client (country, sector, client), and user feedback.
4. **Decide.** You get the trusted answer, the conflicts that were found, stale or ownerless sources, and which expert to ask.
5. **Feedback.** Users can confirm a source or mark it "doesn't apply to my case", which teaches the engine the scope.

The AI (Gemini) only understands the question and routes it to a topic. It never scores: the same input always gives the same score, and every point is explained. See [src/trust-engine/README.md](src/trust-engine/README.md).

## How to run

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # trust engine tests
```

Optional: put `GEMINI_API_KEY=...` in `.env.local` for free-text questions. Without a key the app falls back to keyword matching and still works end to end.

## Structure

- `src/app/`: the demo page (ask → search → trust funnel → answer) and API routes under `api/trust/`
- `src/trust-engine/`: scoring engine, weights in `config.ts`, tests
- `src/lib/gemini-match.ts`: Gemini question routing
- `data/salary/`: fictional source files (policies, Teams exports, emails) used as test data

## Unfinished

- Claims are hand-written mock data. Extracting claims from real documents and Teams exports with an LLM is not built yet.
- No real login: the demo user is fixed, and feedback is stored in memory and resets on restart.
- All people, clients, legal references and amounts are fictional.
