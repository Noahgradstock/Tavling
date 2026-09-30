# Demo data: "Green Light, Red Light" (trust %)

⚠️ **All data is synthetic.** The names, clients, legal references (`[SYNTH]`) and amounts are fictional. They are realistic, but they are not legal advice.

## The story
**Thu 30/09/2026, 15:40.** Lien Peeters, a junior payroll consultant in Ghent, gets a ticket from Sara at Brouwerij De Leeuw: *"What's the max meal voucher value in 2026? A colleague heard €8, I read €10. We need it tomorrow."*
The search finds **8 sources**: 5 say €8, 3 say €10. Which one can she trust?

## Files
| File | What | Used for |
|---|---|---|
| `case_card.json` | The ticket, plus the case card (BE · PC 200 · bediende · meal vouchers · 01/10/2026) and an NL toggle card | Gate |
| `sources.json` | 8 sources (doc/email/Teams, NL/FR) with labels, `via`, evidence quotes and the claimed value | Everything |
| `engine_params.json` | What the payroll engine really applies | Metric 1 System agreement |
| `legal_registry.json` | Fictional legal rules, with values and change dates | Metric 2 Law anchor, plus the gate |
| `people.json` | Lien, Marc (expert), Els (left the company), Tom, Sofie, Pieter, Julien, Daan, Amira | Metrics 3 and 4, and "who can help" |
| `usage_log.json` | Times used, corrections afterwards, expert confirmations | Metrics 4 and 5 |
| `teams_questions.json` | Questions asked in Teams after reading a source | Metric 7 Doubt signal |
| `scoring.json` | The rules, in plain words | Show on the "how is this scored?" screen |
| `trust.mjs` | Reference scorer (`node data/salary/meal-voucher-scenario/trust.mjs`, or `--nl`) | Port to `lib/trust.ts` |

## Expected result (`node data/salary/meal-voucher-scenario/trust.mjs`)
| Trust | Source | Value | Why |
|---|---|---|---|
| 🟢 **95%** | SRC-01 Procedure 2026 PC 200 (NL) | €10 | Engine ✓ · law ✓ · owner Marc ✓ · confirmed by Marc · 64 uses, 0 corrections |
| 🟡 **46%** | SRC-06 Email from Sofie | €10 | Engine ✓, but informal and the **PC is only an AI guess** |
| 🔴 **33%** | SRC-07 Onboarding checklist "versie 2026" | €8 | ⚠️ **The engine uses €10** · the law changed after its last review · 4/23 uses corrected |
| 🔴 **18%** | SRC-08 FR procédure 2026 CP 200 | €8 | 🌍 **The NL version was updated, the FR version was not** · owner Els left the company |
| 🔴 **13%** | SRC-05 Teams message from Tom | €8 | Engine disagrees · 3/9 uses corrected · **6 people asked questions afterwards** |
| 🔴 0% | SRC-02 Procedure 2025 | €8 | Replaced by SRC-01 |
| 🔴 0% | SRC-03 Note CP 124 (FR) | €10 | For PC 124, your case is PC 200 |
| 🔴 0% | SRC-04 NL policy | – | For NL, your case is BE |

## Demo beats this data supports
1. **The sources sort themselves:** 3 sources are out with a reason.
2. **The trust % breakdown:** click 95% and see all 7 metrics.
3. **Gap detection (wow):** the "2026" checklist says €8, but *the payroll engine uses €10*. Nobody had noticed.
4. **European expansion:** FR/NL language drift, and an orphaned owner.
5. **Human confirm:** Lien clicks "Yes, PC 200" on the email, so the email rises from 46% (colleague confirm is +8). Marc confirms, so it rises further (expert confirm is 15). Its gate is now proven. It stays 🟡 on purpose: an email should never outrank the official procedure.
6. **Toggle the case to NL:** everything flips, and only the NL policy stays.
7. **Who can help:** Marc (31 decisions for BE/PC 200, answers in about 12 minutes on average).
