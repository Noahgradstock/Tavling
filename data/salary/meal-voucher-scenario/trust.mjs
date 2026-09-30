// Reference implementation of the trust score (see scoring.json).
// Run: node data/salary/meal-voucher-scenario/trust.mjs            -> scores for the BE case
//      node data/salary/meal-voucher-scenario/trust.mjs --nl       -> the same sources for the NL toggle
// Port to lib/trust.ts in the app; keep it deterministic.
import { readFileSync } from 'node:fs'

const load = f => JSON.parse(readFileSync(new URL(f, import.meta.url)))
const { case_card: beCard, alt_case_card_for_demo_toggle: nlCard } = load('./case_card.json')
const sources = load('./sources.json')
const engine = load('./engine_params.json').params
const registry = load('./legal_registry.json').rules
const people = load('./people.json')
const usage = load('./usage_log.json').usage
const questions = load('./teams_questions.json').questions

const STRONG = ['text', 'metadata', 'registry', 'human', 'client_master_data']
const isStrong = l => l && l.v != null && (STRONG.includes(l.via) || (l.via === 'llm' && l.conf >= 0.9))
const person = id => people.find(p => p.id === id)
const TODAY = '2026-09-30'
const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 864e5

export function gate(src, card) {
  const L = src.labels, c = k => card[k].v
  if (L.country.v && L.country.v !== c('country')) return { status: 'fail', reason: `For ${L.country.v}, your case is ${c('country')}` }
  if (isStrong(L.pc) && c('pc') && L.pc.v !== c('pc')) return { status: 'fail', reason: `For PC ${L.pc.v}, your case is PC ${c('pc')}` }
  if (L.topic.v && L.topic.v !== c('topic')) return { status: 'fail', reason: 'Different topic' }
  if (L.superseded_by.v) return { status: 'fail', reason: `Replaced by ${L.superseded_by.v}` }
  if (L.valid_to.v && L.valid_to.v < c('case_date')) return { status: 'fail', reason: `Expired on ${L.valid_to.v}` }
  if (c('pc') && !isStrong(L.pc)) return { status: 'unknown', reason: `Sector not proven (${L.pc.v ? L.pc.via + ' guess' : 'not stated'})` }
  return { status: 'pass', reason: 'Matches your case' }
}

export function score(src, card, all = sources) {
  const g = gate(src, card)
  if (g.status === 'fail') return { id: src.id, title: src.title, gate: g, total: 0, color: 'red', metrics: [], flags: [] }
  const m = [], flags = []
  const u = usage.find(x => x.source === src.id) || { times_used: 0, corrections_after: 0, confirmations: [] }

  // 1 System agreement
  const e = engine.find(p => p.key === src.claim.key)
  const sys = e && e.value === src.claim.value ? 20 : 0
  if (e && !sys) flags.push(`⚠️ The payroll engine uses €${e.value}, but this source says €${src.claim.value}`)
  m.push({ name: 'System agreement', pts: sys, max: 20 })

  // 2 Law anchor
  const rule = registry.find(r => r.key === src.claim.key && r.valid_from <= card.case_date.v && (!r.valid_to || r.valid_to >= card.case_date.v))
  let law = 0
  if (rule && src.legal_ref === rule.ref) {
    law += 8
    if (src.reviewed_on >= rule.changed_on) law += 7
    else flags.push(`⚠️ The law changed on ${rule.changed_on}, after this source was last reviewed (${src.reviewed_on})`)
  } else if (src.legal_ref) flags.push(`⚠️ Cites ${src.legal_ref}, which is no longer the valid rule`)
  m.push({ name: 'Law anchor', pts: law, max: 15 })

  // 3 Authority and owner
  const owner = person(src.owner)
  let auth = { doc: 8, email: 4, teams: 1 }[src.type] || 0
  if (owner?.status === 'active') auth += 7
  else if (owner) flags.push(`⚠️ Owner ${owner.name} left SD Worx on ${owner.left_on}`)
  m.push({ name: 'Authority and owner', pts: auth, max: 15 })

  // 4 Expert endorsement
  const scopeKey = `${card.country.v}/PC${card.pc.v}`
  let exp = 0
  for (const c of u.confirmations) {
    const p = person(c.by)
    if (p?.status !== 'active') continue
    exp = Math.max(exp, (p.decisions?.[scopeKey] || 0) >= 10 ? 15 : 8)
  }
  m.push({ name: 'Expert endorsement', pts: exp, max: 15 })

  // 5 Outcome record
  let out = 0
  if (u.times_used >= 5) {
    const rate = u.corrections_after / u.times_used
    out = rate < 0.02 ? 15 : rate < 0.1 ? 8 : 0
    if (!out) flags.push(`⚠️ ${u.corrections_after}/${u.times_used} uses were corrected afterwards`)
  }
  m.push({ name: 'Outcome record', pts: out, max: 15, note: u.times_used < 5 ? 'not enough history' : undefined })

  // 6 Independent agreement
  const passing = all.filter(s => s.id !== src.id && gate(s, card).status !== 'fail')
  const groups = new Set(passing.filter(s => s.claim.value === src.claim.value && s.copy_group !== src.copy_group).map(s => s.copy_group))
  m.push({ name: 'Independent agreement', pts: groups.size >= 2 ? 10 : groups.size === 1 ? 5 : 0, max: 10 })
  const contradicting = passing.filter(s => s.claim.value !== src.claim.value)
  if (contradicting.length) flags.push(`↔️ ${contradicting.length} other source(s) give a different value`)

  // 7 Doubt signal
  const q = questions.filter(x => x.source === src.id && daysBetween(x.on, TODAY) <= 90).length
  m.push({ name: 'Doubt signal', pts: q <= 1 ? 10 : q <= 4 ? 5 : 0, max: 10, note: `${q} question(s) in Teams after reading` })

  // Language drift
  if (src.translation_of) {
    const orig = all.find(s => s.id === src.translation_of)
    if (orig && src.reviewed_on < orig.reviewed_on) flags.push(`🌍 The ${orig.language.toUpperCase()} version was updated on ${orig.reviewed_on}, this ${src.language.toUpperCase()} version was not`)
  }

  const total = m.reduce((a, x) => a + x.pts, 0)
  let color = total >= 80 ? 'green' : total >= 40 ? 'yellow' : 'red'
  if (color === 'green' && g.status === 'unknown') color = 'yellow' // AI-only scope caps at yellow
  return { id: src.id, title: src.title, gate: g, total, color, metrics: m, flags }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const card = process.argv.includes('--nl') ? nlCard : beCard
  const dot = { green: '🟢', yellow: '🟡', red: '🔴' }
  for (const r of sources.map(s => score(s, card)).sort((a, b) => b.total - a.total)) {
    console.log(`${dot[r.color]} ${String(r.total).padStart(3)}%  ${r.id}  ${r.title}`)
    console.log(`         gate: ${r.gate.status} (${r.gate.reason})`)
    if (r.metrics.length) console.log('         ' + r.metrics.map(x => `${x.name} ${x.pts}/${x.max}`).join(' · '))
    for (const f of r.flags) console.log('         ' + f)
  }
}
