"use client";

import { useState, type ReactNode } from "react";

type Status = "trusted" | "conflict" | "stale" | "orphan" | "empty";
type SourceType = "official" | "sharepoint" | "teams" | "email";

export type BrainData = {
  company: string;
  reference: string; // the client the topics are scored for
  topics: {
    key: string;
    label: string;
    status: Status;
    answer: string | null;
    score: number | null;
    files: string[];
    claims: {
      id: string;
      value: string;
      source: SourceType;
      title: string;
      author: string | null;
      date: string;
      country: string;
      score: number | null;
      excluded: string | null;
    }[];
  }[];
  people: { id: string; name: string; role: "expert" | "regular" | "new"; team: string; left: boolean; claims: number }[];
  clients: { id: string; name: string; country: string; pc?: string; claims: number }[];
  channels: { type: SourceType; claims: number }[];
  files: string[];
};

type DomainId = "salary" | "people" | "clients" | "channels" | "legal" | "time";
type Sel = { kind: "company" } | { kind: "domain"; id: DomainId } | { kind: "topic"; id: string };
type Pt = { x: number; y: number };

// Geometry of the map (viewBox units).
const W = 1000;
const H = 620;
const C: Pt = { x: 600, y: 310 };
const RING = 225;
const CORE = 64;
// Rounded so server and browser trig render identical markup.
const round = (n: number) => Math.round(n * 100) / 100;
const polar = (o: Pt, r: number, deg: number): Pt => ({
  x: round(o.x + r * Math.cos((deg * Math.PI) / 180)),
  y: round(o.y + r * Math.sin((deg * Math.PI) / 180)),
});

const DOMAINS: { id: DomainId; label: string; angle: number; live: boolean; blurb: string }[] = [
  { id: "salary", label: "Salary", angle: 180, live: true, blurb: "Payroll rules, rates and deadlines, scored source by source." },
  { id: "people", label: "People", angle: 238, live: true, blurb: "Who wrote what, who is an expert, who has left." },
  { id: "clients", label: "Clients", angle: 302, live: true, blurb: "The customers the answers are scoped to." },
  { id: "channels", label: "Channels", angle: 0, live: true, blurb: "Where the knowledge lives today." },
  { id: "legal", label: "Legal", angle: 58, live: false, blurb: "Contracts, GDPR, labour law updates." },
  { id: "time", label: "Time & absence", angle: 122, live: false, blurb: "Schedules, leave balances, working-time rules." },
];
const domainPos = (id: DomainId) => polar(C, RING, DOMAINS.find((d) => d.id === id)!.angle);

const STATUS: Record<Status, { label: string; color: string }> = {
  trusted: { label: "Trusted", color: "#34d399" },
  conflict: { label: "Sources disagree", color: "#fbbf24" },
  stale: { label: "Outdated", color: "#94a3b8" },
  orphan: { label: "No owner", color: "#f87171" },
  empty: { label: "Nothing applies", color: "#475569" },
};

const SHORT: Record<string, string> = {
  "indexation-2026": "Indexation 2026",
  "sick-relapse": "Sick leave relapse",
  "meal-voucher-max": "Meal vouchers",
  "overtime-recovery": "Overtime recovery",
  "holiday-pay": "Holiday pay",
  "end-of-year-bonus": "End-of-year bonus",
  "flexi-job": "Flexi-jobs",
};
const short = (t: { key: string; label: string }) => SHORT[t.key] ?? t.label;

const CHANNEL: Record<SourceType, string> = { official: "Official law", sharepoint: "SharePoint", teams: "Teams", email: "Email" };
const ROLE = { expert: "Expert", regular: "Consultant", new: "New hire" };
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

// A soft curve between two nodes that bends around the core instead of under it.
function curve(a: Pt, b: Pt) {
  const cx = (a.x + b.x) / 2;
  let cy = (a.y + b.y) / 2 - 30;
  const apex = () => ({ x: (a.x + b.x) / 4 + cx / 2, y: (a.y + b.y) / 4 + cy / 2 });
  for (let i = 0; i < 20 && Math.hypot(apex().x - C.x, apex().y - C.y) < CORE + 50; i++) cy += 25;
  return `M${a.x},${a.y} Q${round(cx)},${round(cy)} ${b.x},${b.y}`;
}

export default function BrainMap({ data }: { data: BrainData }) {
  const [sel, setSel] = useState<Sel>({ kind: "company" });
  const [hover, setHover] = useState<Sel | null>(null);
  const focus = hover ?? sel;

  const salary = domainPos("salary");
  const topicPos = (i: number) => polar(salary, 165, 122 + (116 / Math.max(1, data.topics.length - 1)) * i);
  const topicFocus = focus.kind === "topic" ? data.topics.find((t) => t.key === focus.id) : null;

  // When a topic is in focus, light up the areas its claims come from.
  const linked: DomainId[] = topicFocus ? ["channels", ...(topicFocus.claims.some((c) => c.author) ? (["people"] as const) : []), "clients"] : [];

  const isSel = (s: Sel) => JSON.stringify(s) === JSON.stringify(sel);
  const bind = (s: Sel, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": isSel(s),
    className: "brain-node cursor-pointer outline-none",
    onClick: () => setSel(s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSel(s);
      }
    },
    onMouseEnter: () => setHover(s),
    onMouseLeave: () => setHover(null),
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-16 text-[#161616]">
      <header className="mb-6">
        <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">The {data.company} brain</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
          Everything the brain has read, in one map. Hover a node to see what it knows, click it to open the details.
        </p>
      </header>

      <section className="brain-stage grid overflow-hidden rounded-[28px] text-white lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={`Knowledge map of ${data.company}`}>
            <defs>
              <radialGradient id="core-fill" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#a5b8ff" />
                <stop offset="45%" stopColor="#5b6cff" />
                <stop offset="100%" stopColor="#3a1fa8" />
              </radialGradient>
              <radialGradient id="core-halo">
                <stop offset="0%" stopColor="#6d7dff" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#6d7dff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lobe-halo">
                <stop offset="0%" stopColor="#4f8bff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4f8bff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="beam" x1="0" x2="1">
                <stop offset="0%" stopColor="#4f8bff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.9" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* halos */}
            <circle cx={salary.x} cy={salary.y} r={230} fill="url(#lobe-halo)" />
            <circle cx={C.x} cy={C.y} r={190} fill="url(#core-halo)" />

            {/* trunk lines with data flowing into the core */}
            {DOMAINS.map((d) => {
              const p = domainPos(d.id);
              const lit = d.id === "salary" || linked.includes(d.id);
              return (
                <g key={d.id}>
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={C.x}
                    y2={C.y}
                    stroke={lit ? "#7c9bff" : "#fff"}
                    strokeOpacity={d.live ? (lit ? 0.85 : 0.18) : 0.08}
                    strokeWidth={d.id === "salary" ? 2.5 : 1.2}
                    strokeDasharray={d.live ? undefined : "3 7"}
                  />
                  {d.live && <Particle path={`M${p.x},${p.y} L${C.x},${C.y}`} dur={d.id === "salary" ? 2.2 : 3.4} delay={d.angle / 120} />}
                </g>
              );
            })}

            {/* salary topics */}
            {data.topics.map((t, i) => {
              const p = topicPos(i);
              return (
                <g key={t.key}>
                  <line x1={p.x} y1={p.y} x2={salary.x} y2={salary.y} stroke={STATUS[t.status].color} strokeOpacity="0.35" strokeWidth="1" />
                  <Particle path={`M${p.x},${p.y} L${salary.x},${salary.y}`} dur={2.6} delay={i * 0.37} color={STATUS[t.status].color} />
                </g>
              );
            })}

            {/* links from the topic in focus to the areas behind it */}
            {topicFocus &&
              linked.map((id) => (
                <path
                  key={`${topicFocus.key}-${id}`}
                  d={curve(topicPos(data.topics.indexOf(topicFocus)), domainPos(id))}
                  fill="none"
                  stroke="url(#beam)"
                  strokeWidth="1.5"
                  className="brain-synapse"
                />
              ))}

            {data.topics.map((t, i) => {
              const p = topicPos(i);
              const on = topicFocus?.key === t.key;
              const color = STATUS[t.status].color;
              return (
                <g key={t.key} {...bind({ kind: "topic", id: t.key }, `${t.label}: ${STATUS[t.status].label}`)}>
                  <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={on ? 9 : 6} fill={color} filter="url(#glow)" />
                  <text x={p.x - 18} y={p.y + 5} textAnchor="end" fontSize="15" fill="#fff" fillOpacity={on ? 1 : 0.72} fontWeight={on ? 600 : 400}>
                    {short(t)}
                  </text>
                  {on && t.answer && (
                    <text x={p.x + 16} y={p.y + 5} fontSize="14" fontWeight="600" fill={color}>
                      {t.answer}
                    </text>
                  )}
                </g>
              );
            })}

            {/* knowledge areas */}
            {DOMAINS.map((d) => {
              const p = domainPos(d.id);
              const isSalary = d.id === "salary";
              const lit = isSalary || linked.includes(d.id) || (focus.kind === "domain" && focus.id === d.id);
              const r = isSalary ? 40 : d.live ? 32 : 22;
              return (
                <g key={d.id} {...bind({ kind: "domain", id: d.id }, d.live ? d.label : `${d.label}, not connected yet`)}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={isSalary ? "#4f8bff" : lit ? "#1d2f7a" : "#10183d"}
                    stroke={d.live ? (lit ? "#8fb2ff" : "rgba(255,255,255,0.35)") : "rgba(255,255,255,0.18)"}
                    strokeWidth="1.2"
                    strokeDasharray={d.live ? undefined : "3 5"}
                    filter={isSalary || lit ? "url(#glow)" : undefined}
                  />
                  <text
                    x={p.x}
                    y={d.live ? p.y + 5 : p.y + r + 20}
                    textAnchor="middle"
                    fontSize={isSalary ? 16 : 13}
                    fontWeight="600"
                    fill="#fff"
                    fillOpacity={d.live ? 1 : 0.35}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            {/* the company core */}
            <g {...bind({ kind: "company" }, data.company)}>
              <circle cx={C.x} cy={C.y} r={CORE} fill="none" stroke="#8fa2ff" className="brain-pulse" />
              <circle cx={C.x} cy={C.y} r={CORE} fill="none" stroke="#8fa2ff" className="brain-pulse brain-pulse-late" />
              <circle cx={C.x} cy={C.y} r={CORE} fill="url(#core-fill)" filter="url(#glow)" />
              <text x={C.x} y={C.y + 11} textAnchor="middle" fontSize="32" fill="#fff" className="font-serif">
                {data.company}
              </text>
            </g>
          </svg>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-5 text-xs text-white/55">
            {(["trusted", "conflict", "stale", "orphan"] as Status[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].color, boxShadow: `0 0 8px ${STATUS[s].color}` }} />
                {STATUS[s].label}
              </li>
            ))}
          </ul>
        </div>

        <aside className="border-t border-white/10 bg-white/[0.04] p-6 lg:max-h-[640px] lg:overflow-y-auto lg:border-l lg:border-t-0" aria-live="polite">
          <Panel sel={sel} data={data} onSelect={setSel} />
        </aside>
      </section>
    </main>
  );
}

// A small light that travels along a line, like a signal moving through the network.
function Particle({ path, dur, delay, color = "#c7d2ff" }: { path: string; dur: number; delay: number; color?: string }) {
  return (
    <circle r="2.4" fill={color} className="brain-particle" filter="url(#glow)">
      <animateMotion dur={`${dur}s`} begin={`${round(delay)}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

function Panel({ sel, data, onSelect }: { sel: Sel; data: BrainData; onSelect: (s: Sel) => void }) {
  const person = (id: string | null) => (id ? data.people.find((p) => p.id === id)?.name ?? id : "Official publication");

  if (sel.kind === "company") {
    const n = (s: Status[]) => data.topics.filter((t) => s.includes(t.status)).length;
    return (
      <>
        <Title kicker="Company" title={data.company} />
        <p className="text-sm leading-relaxed text-white/65">
          The brain has read {data.files.length} files about salary and scored every claim in them. The other subjects light up once their
          sources are connected.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Big n={n(["trusted"])} label="trusted answers" color={STATUS.trusted.color} />
          <Big n={n(["conflict", "stale", "orphan"])} label="need a check" color={STATUS.conflict.color} />
        </div>
        <List>
          {DOMAINS.map((d) => (
            <Row key={d.id} onClick={() => onSelect({ kind: "domain", id: d.id })} right={d.live ? "Connected" : "Empty"} muted={!d.live}>
              {d.label}
            </Row>
          ))}
        </List>
      </>
    );
  }

  if (sel.kind === "domain") {
    const d = DOMAINS.find((x) => x.id === sel.id)!;
    const back = <Back onClick={() => onSelect({ kind: "company" })} />;
    if (!d.live)
      return (
        <>
          {back}
          <Title kicker="Not connected yet" title={d.label} />
          <p className="text-sm leading-relaxed text-white/65">{d.blurb}</p>
          <p className="mt-4 rounded-xl border border-dashed border-white/15 p-3 text-sm leading-relaxed text-white/55">
            Nothing here yet. Add source files under <code>data/</code> and this area lights up like Salary.
          </p>
        </>
      );
    const rows =
      d.id === "salary"
        ? data.topics.map((t) => (
            <Row key={t.key} onClick={() => onSelect({ kind: "topic", id: t.key })} dot={STATUS[t.status].color} right={t.answer ?? "–"}>
              {short(t)}
            </Row>
          ))
        : d.id === "people"
          ? data.people.map((p) => (
              <Row key={p.id} right={p.left ? "Left" : ROLE[p.role]} muted={p.left}>
                {p.name}
              </Row>
            ))
          : d.id === "clients"
            ? data.clients.map((c) => (
                <Row key={c.id} right={[c.country, c.pc && `PC ${c.pc}`].filter(Boolean).join(" ")}>
                  {c.name}
                </Row>
              ))
            : data.channels.map((c) => (
                <Row key={c.type} right={`${c.claims} claims`}>
                  {CHANNEL[c.type]}
                </Row>
              ));
    return (
      <>
        {back}
        <Title kicker="Knowledge area" title={d.label} />
        <p className="text-sm text-white/65">{d.blurb}</p>
        <List>{rows}</List>
      </>
    );
  }

  const t = data.topics.find((x) => x.key === sel.id)!;
  const color = STATUS[t.status].color;
  return (
    <>
      <Back onClick={() => onSelect({ kind: "domain", id: "salary" })} label="Salary" />
      <Title kicker="Salary topic" title={t.label} />
      <div className="rounded-2xl border p-4" style={{ borderColor: `${color}55`, background: `${color}14` }}>
        <div className="text-xs font-medium" style={{ color }}>
          {STATUS[t.status].label}
          {t.score !== null && `, ${pct(t.score)} sure`}
        </div>
        <div className="mt-1 font-serif text-4xl leading-tight">{t.answer ?? "No answer yet"}</div>
        <div className="mt-1 text-xs text-white/45">For {data.reference}</div>
      </div>
      <h3 className="mb-1 mt-5 text-xs text-white/45">What each source says</h3>
      <ul className="divide-y divide-white/10">
        {t.claims.map((c) => (
          <li key={c.id} className={`py-2 text-sm ${c.excluded ? "opacity-40" : ""}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{c.value}</span>
              <span className="shrink-0 text-xs tabular-nums text-white/55">{c.excluded ? "Other client" : pct(c.score)}</span>
            </div>
            <div className="text-xs text-white/45">
              {CHANNEL[c.source]}, {person(c.author)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Title({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-[#8fb2ff]">{kicker}</div>
      <h2 className="font-serif text-3xl leading-tight">{title}</h2>
    </div>
  );
}

function Big({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3">
      <div className="font-serif text-4xl leading-none" style={{ color, textShadow: `0 0 18px ${color}88` }}>
        {n}
      </div>
      <div className="mt-1 text-xs text-white/55">{label}</div>
    </div>
  );
}

function Back({ onClick, label = "Overview" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-3 text-xs text-white/50 transition hover:text-white">
      ‹ {label}
    </button>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="mt-4 divide-y divide-white/10">{children}</ul>;
}

function Row({ children, right, dot, muted, onClick }: { children: ReactNode; right?: ReactNode; dot?: string; muted?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right && <span className="max-w-[45%] shrink-0 truncate text-xs text-white/50">{right}</span>}
    </>
  );
  const cls = `flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm ${muted ? "text-white/35" : "text-white/90"}`;
  return (
    <li>
      {onClick ? (
        <button onClick={onClick} className={`${cls} transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#8fb2ff]`}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
