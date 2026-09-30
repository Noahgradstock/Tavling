# Salary knowledge (fictional test data)

Fictional source files for testing the trust score. Names, clients, legal references and amounts are made up.

| Folder | Topic | Files |
|---|---|---|
| `sick-leave/` | Relapse period and guaranteed salary (the demo case) | policy, PDF manual, NL Confluence page, Teams export, newsletter, draft email + `sources.json` |
| `indexation/` | Wage indexation January 2026 (PC 200, PC 118, NL, client exception) | 2 official notices, draft guide, Teams export, client email |
| `meal-vouchers/` | Max employer part 2026 | royal decree summary, old manual annex, Teams export, client question |
| `bonus-and-holiday-pay/` | End-of-year bonus (PC 200 vs. client agreement) and holiday pay (BE vs. NL) | sector agreement, client email, Teams export, BE guide, NL Confluence page |
| `meal-voucher-scenario/` | Earlier scenario with engine parameters, legal registry, usage and doubt signals, plus a reference scorer (`node data/salary/meal-voucher-scenario/trust.mjs`) | JSON files |

`sources.json` in this folder describes every claim in `indexation/`, `meal-vouchers/` and `bonus-and-holiday-pay/`: value, author, date, scope (country, PC, client) and the expected trust outcome. It also has test questions with the expected answer. Claim ids match `src/trust-engine/mock` where the same claim exists there.
