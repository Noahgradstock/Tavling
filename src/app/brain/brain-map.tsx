"use client";

import { useState, type ReactNode } from "react";
import type { Doc } from "@/lib/documents";
import { DocCard, KindBadge, TrustTag, Viewer, type ClaimScores } from "./documents";

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
  documents: Doc[];
  folders: Record<string, string>;
  scores: ClaimScores;
};

type DomainId = "salary" | "people" | "clients" | "channels" | "legal" | "time";
type Sel = { kind: "company" } | { kind: "domain"; id: DomainId } | { kind: "topic"; id: string };
type Pt = { x: number; y: number };

// Geometry of the map (viewBox units).
const W = 1000;
const H = 600;
const C: Pt = { x: 610, y: 300 };
const RING = 220;
const CORE = 60;
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

// Same colours as the answer card in the chat: blue is trusted, red contradicts.
const STATUS: Record<Status, { label: string; color: string }> = {
  trusted: { label: "Trusted", color: "#1463ff" },
  conflict: { label: "Sources disagree", color: "#d97706" },
  stale: { label: "Outdated", color: "#a3a3a3" },
  orphan: { label: "No owner", color: "#c62a30" },
  empty: { label: "Nothing applies", color: "#d4d4d4" },
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

const CHANNEL: Record<SourceType, string> = { official: "Official", sharepoint: "SharePoint", teams: "Teams", email: "Email" };
const ROLE = { expert: "Expert", regular: "Consultant", new: "New hire" };
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

// A soft curve between two nodes that bends around the core instead of under it.
function curve(a: Pt, b: Pt) {
  const cx = (a.x + b.x) / 2;
  let cy = (a.y + b.y) / 2 - 30;
  const apex = () => ({ x: (a.x + b.x) / 4 + cx / 2, y: (a.y + b.y) / 4 + cy / 2 });
  for (let i = 0; i < 20 && Math.hypot(apex().x - C.x, apex().y - C.y) < CORE + 45; i++) cy += 25;
  return `M${a.x},${a.y} Q${round(cx)},${round(cy)} ${b.x},${b.y}`;
}

export default function BrainMap({ data }: { data: BrainData }) {
  const [sel, setSel] = useState<Sel>({ kind: "company" });
  const [hover, setHover] = useState<Sel | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [open, setOpen] = useState<Doc | null>(null);
  const focus = hover ?? sel;

  const salary = domainPos("salary");
  const topicPos = (i: number) => polar(salary, 160, 122 + (116 / Math.max(1, data.topics.length - 1)) * i);
  const topicFocus = focus.kind === "topic" ? data.topics.find((t) => t.key === focus.id) : null;
  const linked: DomainId[] = topicFocus ? ["channels", "people", "clients"] : [];

  // Selecting a topic also narrows the documents below to the folder it comes from.
  const select = (s: Sel) => {
    setSel(s);
    if (s.kind === "topic") {
      const f = data.topics.find((t) => t.key === s.id)?.files[0]?.split("/")[0];
      setFolder(f && data.folders[f] ? f : null);
    } else if (s.kind === "company") setFolder(null);
  };
  const openFile = (file: string) => setOpen(data.documents.find((d) => d.path === file) ?? null);

  const isSel = (s: Sel) => JSON.stringify(s) === JSON.stringify(sel);
  const bind = (s: Sel, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": isSel(s),
    className: "brain-node cursor-pointer outline-none",
    onClick: () => select(s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(s);
      }
    },
    onMouseEnter: () => setHover(s),
    onMouseLeave: () => setHover(null),
  });

  const docs = data.documents.filter((d) => !folder || d.folder === folder);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-20 text-[#161616]">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">The {data.company} brain</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Everything the brain has read, and how it fits together. Pick a topic to see the answer and the documents behind it.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={`Knowledge map of ${data.company}`}>
            <defs>
              <filter id="lift" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08" />
              </filter>
            </defs>

            <circle cx={C.x} cy={C.y} r={RING} fill="none" stroke="#161616" strokeOpacity="0.06" />

            {DOMAINS.map((d) => {
              const p = domainPos(d.id);
              const isSalary = d.id === "salary";
              const lit = linked.includes(d.id);
              return (
                <line
                  key={d.id}
                  x1={p.x}
                  y1={p.y}
                  x2={C.x}
                  y2={C.y}
                  stroke={isSalary ? "#1463ff" : lit ? "#9db8ff" : "#e5e5e5"}
                  strokeWidth={isSalary ? 2 : 1.25}
                  strokeDasharray={d.live ? undefined : "3 6"}
                />
              );
            })}
            {data.topics.map((t, i) => {
              const p = topicPos(i);
              return <line key={t.key} x1={p.x} y1={p.y} x2={salary.x} y2={salary.y} stroke="#e5e5e5" strokeWidth="1.25" />;
            })}

            {topicFocus &&
              linked.map((id) => (
                <path
                  key={`${topicFocus.key}-${id}`}
                  d={curve(topicPos(data.topics.indexOf(topicFocus)), domainPos(id))}
                  fill="none"
                  stroke="#1463ff"
                  strokeOpacity="0.35"
                  strokeWidth="1.25"
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
                  <circle cx={p.x} cy={p.y} r={on ? 8 : 6} fill={color} stroke="#fff" strokeWidth="2.5" />
                  <text x={p.x - 16} y={p.y + 5} textAnchor="end" fontSize="14.5" fill="#161616" fillOpacity={on ? 1 : 0.75} fontWeight={on ? 600 : 400}>
                    {short(t)}
                  </text>
                  {on && t.answer && (
                    <text x={p.x + 14} y={p.y + 5} fontSize="13.5" fontWeight="600" fill={color}>
                      {t.answer}
                    </text>
                  )}
                </g>
              );
            })}

            {DOMAINS.map((d) => {
              const p = domainPos(d.id);
              const isSalary = d.id === "salary";
              const on = linked.includes(d.id) || (focus.kind === "domain" && focus.id === d.id);
              const r = isSalary ? 38 : d.live ? 32 : 20;
              return (
                <g key={d.id} {...bind({ kind: "domain", id: d.id }, d.live ? d.label : `${d.label}, not connected yet`)}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={isSalary ? "#1463ff" : d.live ? "#fff" : "#fafaf9"}
                    stroke={isSalary ? "none" : on ? "#1463ff" : d.live ? "#e5e5e5" : "#d4d4d4"}
                    strokeWidth="1.25"
                    strokeDasharray={d.live ? undefined : "3 4"}
                    filter={d.live ? "url(#lift)" : undefined}
                  />
                  <text
                    x={p.x}
                    y={d.live ? p.y + 4.5 : p.y + r + 18}
                    textAnchor="middle"
                    fontSize={isSalary ? 15 : 12.5}
                    fontWeight="500"
                    fill={isSalary ? "#fff" : d.live ? "#161616" : "#a3a3a3"}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}

            <g {...bind({ kind: "company" }, data.company)}>
              <circle cx={C.x} cy={C.y} r={CORE} fill="#161616" filter="url(#lift)" />
              <text x={C.x} y={C.y + 10} textAnchor="middle" fontSize="30" fill="#fff" className="font-serif">
                {data.company}
              </text>
            </g>
          </svg>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-5 text-xs text-neutral-500">
            {(["trusted", "conflict", "stale", "orphan"] as Status[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].color }} />
                {STATUS[s].label}
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:max-h-[600px] lg:overflow-y-auto" aria-live="polite">
          <Panel sel={sel} data={data} onSelect={select} onOpenFile={openFile} />
        </aside>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-4xl leading-none">Documents</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {docs.length} of {data.documents.length} source documents. Open one to read it and zoom in.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter documents">
            <Pill on={!folder} onClick={() => setFolder(null)}>
              All
            </Pill>
            {Object.entries(data.folders).map(([id, label]) => (
              <Pill key={id} on={folder === id} onClick={() => setFolder(id)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {docs.map((d) => (
            <DocCard key={d.path} doc={d} scores={data.scores} onOpen={() => setOpen(d)} />
          ))}
        </div>
      </section>

      {open && <Viewer doc={open} scores={data.scores} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-[#161616] bg-[#161616] text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
    >
      {children}
    </button>
  );
}

function Panel({ sel, data, onSelect, onOpenFile }: { sel: Sel; data: BrainData; onSelect: (s: Sel) => void; onOpenFile: (file: string) => void }) {
  const person = (id: string | null) => (id ? data.people.find((p) => p.id === id)?.name ?? id : null);

  if (sel.kind === "company") {
    const n = (s: Status[]) => data.topics.filter((t) => s.includes(t.status)).length;
    return (
      <>
        <Title kicker="Company" title={data.company} />
        <p className="text-sm leading-relaxed text-neutral-600">
          The brain has read {data.documents.length} documents about salary. The other subjects fill in once their sources are connected.
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
          <p className="text-sm leading-relaxed text-neutral-600">{d.blurb}</p>
          <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-500">
            Nothing here yet. Add source files under <code>data/</code> and this area fills in like Salary.
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
        <p className="text-sm text-neutral-600">{d.blurb}</p>
        <List>{rows}</List>
      </>
    );
  }

  const t = data.topics.find((x) => x.key === sel.id)!;
  const color = STATUS[t.status].color;
  return (
    <>
      <Back onClick={() => onSelect({ kind: "domain", id: "salary" })} label="Salary" />
      <div className="text-xs uppercase tracking-wide text-neutral-400">{t.label}</div>
      <div className="mt-2 font-serif text-5xl leading-none tracking-tight">{t.answer ?? "No answer yet"}</div>
      <div className="mt-2 text-sm" style={{ color }}>
        {STATUS[t.status].label}
        {t.score !== null && `, ${pct(t.score)}`}
      </div>
      <div className="mt-1 text-xs text-neutral-400">For {data.reference}</div>

      <h3 className="mt-6 text-xs text-neutral-400">What each source says</h3>
      <ul className="mt-1 divide-y divide-neutral-100">
        {t.claims.map((c) => {
          const doc = c.id && data.documents.find((d) => d.claims.some((x) => x.id === c.id));
          const inner = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{c.value}</span>
                <span className="shrink-0 text-xs">
                  <TrustTag score={c.score} excluded={c.excluded} />
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                {doc ? <KindBadge kind={doc.kind} /> : <span>{CHANNEL[c.source]}</span>}
                <span className="truncate">{person(c.author) ?? c.title}</span>
              </div>
            </>
          );
          return (
            <li key={c.id} className={c.excluded ? "opacity-50" : ""}>
              {doc ? (
                <button onClick={() => onOpenFile(doc.path)} className="block w-full rounded-lg px-1.5 py-2 text-left text-sm transition hover:bg-neutral-50">
                  {inner}
                </button>
              ) : (
                <div className="px-1.5 py-2 text-sm">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Title({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-neutral-400">{kicker}</div>
      <h2 className="font-serif text-3xl leading-tight">{title}</h2>
    </div>
  );
}

function Big({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3">
      <div className="font-serif text-4xl leading-none" style={{ color }}>
        {n}
      </div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function Back({ onClick, label = "Overview" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mb-3 text-xs text-neutral-400 transition hover:text-neutral-900">
      ‹ {label}
    </button>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="mt-4 divide-y divide-neutral-100">{children}</ul>;
}

function Row({ children, right, dot, muted, onClick }: { children: ReactNode; right?: ReactNode; dot?: string; muted?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right && <span className="max-w-[45%] shrink-0 truncate text-xs text-neutral-500">{right}</span>}
    </>
  );
  const cls = `flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm ${muted ? "text-neutral-400" : ""}`;
  return (
    <li>
      {onClick ? (
        <button onClick={onClick} className={`${cls} transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-[#1463ff]`}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
