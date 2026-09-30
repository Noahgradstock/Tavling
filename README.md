<div align="center">

# Company brain

**One answer from policies, Teams, email and the law, and the reason you can trust it.**

[Live demo](https://tavling-eight.vercel.app) · [Trust engine](src/trust-engine/README.md) · Tectonic Hackathon 2026 · SD Worx challenge

Built by team Aleida.ai: Ilke Seynaeve, Isak Andersson, Noa Gradstock

<img src="docs/3-answer.png" alt="The answer card: 8 weeks, trust score 96, and how the brain decided" width="760">

</div>

## The problem

A client asks an urgent payroll question. The answer is spread across a policy, an old manual, a Dutch guide, a Teams thread and a draft email, and they disagree. Search finds all of them, but it can't tell you which one to trust.

Company brain takes the consultant from *"I found something"* to *"I understand why I can rely on it"*.

## How it works

```mermaid
flowchart LR
    A[Ask<br/>any language] --> B[Search<br/>law · SharePoint · Teams · email]
    B --> C[Filter<br/>does it apply to this client?]
    C --> D[Score<br/>six trust layers]
    D --> E[Decide<br/>answer · conflicts · expert]
    E -. feedback .-> D
```

| | Step | What happens |
|---|---|---|
| 1 | **Ask** | Type a question or pick an example. Gemini understands it and routes it to a topic. |
| 2 | **Search** | Every source that mentions the topic is collected. |
| 3 | **Filter** | Sources for another country, sector or client are set aside, with the reason shown. |
| 4 | **Score** | Each claim is scored on six layers: authority, freshness, corroboration, consistency with the law, relevance, feedback. |
| 5 | **Decide** | The trusted answer, the sources that disagree, and which expert to ask. |
| 6 | **Learn** | Users mark an answer correct, wrong, outdated or "not my case", and the scores update. |

<table>
<tr>
<td width="50%"><img src="docs/1-ask.png" alt="Ask a question for a client"><br><sub><b>1. Ask</b> a question for a specific client</sub></td>
<td width="50%"><img src="docs/2-score.png" alt="Sources narrowed from 6 found to 1 to read first"><br><sub><b>2–4. Choose</b>: 6 found, 5 apply, 2 trusted, 1 to read first</sub></td>
</tr>
</table>

## Why you can trust it

Gemini only interprets the question. The score comes from a deterministic engine: the same input always gives the same score, and every point is explained. Nothing is hidden in a black box. Weights and rules are in [src/trust-engine/config.ts](src/trust-engine/config.ts).

## The trust algorithm

Every source is split into **claims**: one statement, one value, one scope (country, sector, client). Each claim starts at 50% and six layers add or subtract points. The points are summed and turned into a percentage (log-odds: +2 ≈ 88%, −2 ≈ 12%).

| Layer | Question | Points |
|---|---|---|
| 1. Authority | Who said it? | official +3 · expert +1 · new hire −0.5 · author left the company −1 |
| 2. Freshness | Is it current? | −1 per topic half-life (max −2) · written before the rule changed −2.5 |
| 3. Corroboration | Who agrees? | expert 👍 +0.5 each · colleague says the same +0.7 · corrected in a reply −1.5 |
| 4. Consistency | Does it match the law? | matches +2 · contradicts −3 · client agreement that deviates: exception, +0.5 |
| 5. Relevance | Does it fit this case? | client +1.5 · sector +1 · country +0.3 · other country or sector: set aside |
| 6. Feedback | Did it work for others? | votes weighted by role, max ±2 · votes can't overrule the law |

**Hard caps** stop a high sum from hiding a real problem: contradicts the law → max 20%, written before the current rule → max 30%, no expert or official source behind it → max 60%.

**Which answer wins:** the most specific trusted claim (≥ 75%). A client's own agreement beats the sector rule, and when the law and a colleague say the same thing, the law is shown as the source. Two trusted claims with different values mean **experts disagree**, and the brain says so instead of guessing.

**Worked example**: "What is the minimum company car benefit in 2026?" (Belgium)

| Source | Says | Why | Score |
|---|---|---|---|
| Official notice 2026 | €1,650 | +3 official | **96%** ✓ answer |
| Teams, Jan (expert) | €1,650 | +1 expert, +1 two expert 👍, +2 matches law | 98% backs it |
| Official notice 2025 | €1,600 | +3 official, −2.5 old rule → capped | 30% |
| Teams, Nora (new hire) | €1,600 | −0.5 new hire, −1.5 corrected by Jan, −3 contradicts law | 1% |
| Company car guide | €1,600 | −1 author left, −2.5 old rule, −3 contradicts law | 0% |

**Does it work?** `npm test` runs the engine on 24 test questions over 19 salary topics in [data/salary](data/salary) (official notices, SharePoint guides, Teams exports, client emails) and checks every answer. All 24 pass.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # trust engine tests
```

The app needs a login. Create demo accounts once (user ids must exist in the knowledge base, e.g. `sofie`, `anna`, `tom`):

```bash
node scripts/create-users.mjs sofie anna tom
```

It prints a password per user and two lines, `SESSION_SECRET` and `AUTH_USERS`. Put those two lines in `.env.local` (see `.env.example`) and share the passwords privately. Only scrypt hashes are stored, never plain passwords, and `.env.local` is not committed.

Optional: put `GEMINI_API_KEY=...` in `.env.local` for free-text questions. Without a key the app falls back to keyword matching and still works end to end.

The live demo runs on Vercel (project `tavling`). Pushing to GitHub does not deploy automatically yet; run `vercel deploy --prod` from the repo folder. Environment variables (encrypted in the Vercel project): `SESSION_SECRET` and `AUTH_USERS` are required, otherwise every page redirects to a login that cannot succeed. Recommended: add Upstash Redis from the Vercel Marketplace, which sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Optional: `GEMINI_API_KEY`, and `GUEST_ACCESS=off` to disable guest access.

## Security

Built for the checks of the Aikido AI Code Audit: authentication, authorization, IDOR and business logic.

- **Login:** every page and API route needs a session, except the login page and "Continue as guest" (`src/proxy.ts`), and each route handler and data page checks it again (`currentUser()` in `src/lib/trust-server.ts`, `requireUser()` in `src/lib/session.ts`).
- **Sessions:** signed cookie (HMAC-SHA256), `HttpOnly`, `SameSite=Strict`, `Secure` in production, valid for 8 hours (`src/lib/auth.ts`). Logout revokes the session on the server, so a copied cookie stops working too. Changing a user's password ends all of their sessions.
- **Passwords:** scrypt hashes only, constant-time comparison. 5 failed attempts block that account from that IP for 15 minutes (so nobody can lock a colleague out), 50 per IP overall.
- **Voting:** the voter is always the signed-in user from the session, never a value sent by the browser. One vote per user per claim, and only for a case the source actually applies to, so nobody can hide a source for another country, sector or client. Users who left the company cannot sign in.
- **Abuse limits:** 30 questions and 60 votes per user per minute; request bodies over 10 KB are refused.
- **Client access:** consultants only see their own client portfolio, experts every client in their own country (`src/lib/access.ts`). Checked in every route: asking, voting, opening a document and the brain map. Another client's agreements and emails are never sent to the browser.
- **Guest:** "Continue as guest" gives a read-only demo session. Guests can ask but not vote, and it can be switched off with `GUEST_ACCESS=off`.
- **Shared state:** revoked sessions, rate limits and votes live in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (Vercel Marketplace, free tier), so every server instance sees the same state (`src/lib/store.ts`). Without them they are kept in memory.
- **CSRF:** POST routes refuse requests from another origin.
- **AI privacy:** names, clients, ages and identifiers are masked before a question is sent to Gemini (`src/lib/privacy.ts`), and Gemini never sees the sources or scores anything.
- **Headers:** `X-Frame-Options`, `Content-Security-Policy: frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (`next.config.ts`).
- **Secrets:** no keys or passwords in the repo; all in environment variables.

## Structure

| Path | What |
|---|---|
| `src/app/` | The demo page (ask → search → trust funnel → answer), the login page, and API routes under `api/trust/` and `api/auth/` |
| `src/trust-engine/` | Scoring engine, weights in `config.ts`, tests |
| `src/lib/auth.ts`, `src/proxy.ts` | Sessions, passwords and the login gate (tests in `src/lib/auth.test.ts`) |
| `scripts/create-users.mjs` | Creates demo accounts |
| `src/lib/gemini-match.ts` | Gemini question routing |
| `data/salary/` | Fictional source files (policies, Teams exports, emails). The engine reads claims from `sources.json` and quotes from the files. The test questions in `sources.json` run as part of `npm test` |

## Unfinished

- Claims are listed by hand in `data/salary/sources.json` (the quotes are read from the files). Extracting claims from new documents automatically with an LLM is not built yet.
- Overtime and flexi-jobs have no data files yet and use mock claims from `src/trust-engine/mock/`. Sick leave has source files in `data/salary/sick-leave/` but its claims are not in `data/salary/sources.json` yet, so it still uses the mock claims.
- Login uses demo accounts from an environment variable. In production this would be single sign-on with Microsoft Entra ID, which also gives each user's real role and team.
- Without Upstash Redis configured, votes, rate limits and logouts are kept in memory: they reset on restart and are not shared between server instances.
- The client portfolio per consultant is a fixed demo list in `src/lib/access.ts`; in production it would come from SD Worx's portfolio system.
- All people, clients, legal references and amounts are fictional.
