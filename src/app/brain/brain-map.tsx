"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Doc, DocKind } from "@/lib/documents";
import { KIND, KindBadge, TrustTag, Viewer, type ClaimScores } from "./documents";
import Pipeline from "./pipeline";

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

type Topic = BrainData["topics"][number];
type DomainId = "salary" | "people" | "clients" | "channels" | "legal" | "time";
type Sel = { kind: "company" } | { kind: "domain"; id: DomainId } | { kind: "topic"; id: string };
type Pt = { x: number; y: number };
type Placed = { topic: Topic; docs: { doc: Doc }[] };

// A mind map that opens one branch at a time: the company, then Salary's topics, then one topic's documents.
// Every node always exists; each level gives it a position, and CSS moves it there.
const W = 1000;
const H = 640;
const C: Pt = { x: 540, y: 320 };
const RING = 230;

const round = (n: number) => Math.round(n * 100) / 100;
const polar = (o: Pt, r: number, deg: number): Pt => ({
  x: round(o.x + r * Math.cos((deg * Math.PI) / 180)),
  y: round(o.y + r * Math.sin((deg * Math.PI) / 180)),
});
// Evenly spread n items over an arc of `span` degrees centred on `mid`.
const spread = (i: number, n: number, mid: number, span: number) => (n < 2 ? mid : mid - span / 2 + (span / (n - 1)) * i);

const DOMAINS: { id: DomainId; label: string; angle: number; live: boolean; blurb: string }[] = [
  { id: "salary", label: "Salary", angle: 180, live: true, blurb: "Payroll rules, rates and deadlines, scored source by source." },
  { id: "people", label: "People", angle: 235, live: true, blurb: "Who wrote what, who is an expert, who has left." },
  { id: "clients", label: "Clients", angle: 305, live: true, blurb: "The customers the answers are scoped to." },
  { id: "channels", label: "Channels", angle: 0, live: true, blurb: "Where the knowledge lives today." },
  { id: "legal", label: "Legal", angle: 55, live: false, blurb: "Contracts, GDPR, labour law updates." },
  { id: "time", label: "Recruitment", angle: 125, live: false, blurb: "Vacancies, candidates and onboarding." },
];

// Same colours as the answer card in the chat: blue is trusted, red contradicts.
const STATUS: Record<Status, { label: string; color: string }> = {
  trusted: { label: "Trusted", color: "#1463ff" },
  conflict: { label: "Sources disagree", color: "#d97706" },
  stale: { label: "Outdated", color: "#a3a3a3" },
  orphan: { label: "No owner", color: "#c62a30" },
  empty: { label: "Nothing applies", color: "#d4d4d4" },
};
const RANK: Record<Status, number> = { trusted: 0, conflict: 1, stale: 2, orphan: 3, empty: 4 };

// Short names that fit on the map; the full label shows in the panel.
const SHORT: Record<string, string> = {
  "indexation-2026": "Indexation",
  "sick-relapse": "Sick relapse",
  "meal-voucher-max": "Meal vouchers",
  "overtime-recovery": "Overtime rest",
  "holiday-pay": "Holiday pay",
  "end-of-year-bonus": "Year-end bonus",
  "flexi-job": "Flexi-jobs",
  "eco-vouchers": "Eco vouchers",
  "company-car-minimum": "Company car",
  "mileage-allowance": "Mileage",
  "telework-allowance": "Telework",
  "overtime-premium": "Overtime pay",
  "maternity-leave": "Maternity leave",
  "notice-period-5y": "Notice period",
  "minimum-wage": "Minimum wage",
  "student-work-hours": "Student work",
  "sick-note": "Sick note",
  "payroll-cutoff": "Payroll cut-off",
  "bike-allowance": "Bike allowance",
};
const short = (t: { key: string; label: string }) => SHORT[t.key] ?? t.label;

// What goes inside a document's circle.
const ABBR: Record<DocKind, string> = {
  PDF: "PDF",
  Policy: "DOC",
  Guide: "MD",
  Official: "LAW",
  SharePoint: "SP",
  Confluence: "WIKI",
  Email: "EML",
  Teams: "CHAT",
  Newsletter: "HTML",
};

const CHANNEL: Record<SourceType, string> = { official: "Official", sharepoint: "SharePoint", teams: "Teams", email: "Email" };
const ROLE = { expert: "Expert", regular: "Consultant", new: "New hire" };
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// A title in at most two short lines.
function wrap(title: string, n: number): string[] {
  const lines: string[] = [];
  for (const word of title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= n) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.length > 2 ? [lines[0], clip(lines.slice(1).join(" "), n)] : lines.map((l) => clip(l, n));
}

// A soft mind-map branch from a parent to a child.
const branch = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${round(mx)},${a.y} ${round(mx)},${b.y} ${b.x},${b.y}`;
};

// Documents belong to the topics whose claims cite them; a document without claims joins the first topic of its folder.
function place(data: BrainData): Placed[] {
  const topics = [...data.topics].sort((a, b) => RANK[a.status] - RANK[b.status] || short(a).localeCompare(short(b)));
  const firstOfFolder = new Map<string, string>();
  topics.forEach((t) => t.files.forEach((f) => firstOfFolder.has(f.split("/")[0]) || firstOfFolder.set(f.split("/")[0], t.key)));
  return topics.map((topic) => ({
    topic,
    docs: data.documents.filter((d) => topic.files.includes(d.path) || (!d.claims.length && firstOfFolder.get(d.folder) === topic.key)).map((doc) => ({ doc })),
  }));
}

export default function BrainMap({ data }: { data: BrainData }) {
  const placed = useMemo(() => place(data), [data]);
  const [sel, setSel] = useState<Sel>({ kind: "company" });
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<Doc | null>(null);

  // Which branch is open decides the level: 0 the company, 1 Salary's topics, 2 one topic's documents.
  const topicSel = sel.kind === "topic" ? placed.find((p) => p.topic.key === sel.id) : undefined;
  const level = topicSel ? 2 : sel.kind === "domain" && sel.id === "salary" ? 1 : 0;

  // Positions per level.
  const company: Pt = level === 0 ? C : { x: 70, y: 320 };
  const companyR = level === 0 ? 60 : 30;
  const salary: Pt = level === 0 ? polar(C, RING, 180) : level === 1 ? { x: 230, y: 320 } : { x: 190, y: 320 };
  const domainPos = (d: (typeof DOMAINS)[number]): Pt => (d.id === "salary" ? salary : level === 0 ? polar(C, RING, d.angle) : company);
  const topicPos = (i: number): Pt => {
    const n = placed.length;
    if (level === 0) return salary;
    // An evenly spaced column that bulges out in the middle, so every label has its own line.
    const t = n < 2 ? 0 : (i / (n - 1)) * 2 - 1;
    if (level === 1) return { x: round(salary.x + 190 + 90 * (1 - t * t)), y: round(320 + t * 280) };
    return { x: round(salary.x + 95 + 35 * (1 - t * t)), y: round(335 + t * 235) };
  };
  const focus: Pt = { x: 470, y: 320 }; // where an opened topic sits
  const docPos = (i: number, n: number): Pt => polar(focus, 215, spread(i, n, 0, Math.min(140, n * 24)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || open) return;
      setSel(level === 2 ? { kind: "domain", id: "salary" } : { kind: "company" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, open]);

  const bind = (s: Sel, label: string, hoverKey?: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    className: "brain-node cursor-pointer outline-none",
    onClick: () => setSel(s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSel(s);
      }
    },
    onMouseEnter: () => hoverKey && setHover(hoverKey),
    onMouseLeave: () => hoverKey && setHover(null),
  });
  const at = (p: Pt) => ({ transform: `translate(${p.x}px, ${p.y}px)` });

  const crumbs: { label: string; to: Sel }[] = [
    { label: data.company, to: { kind: "company" } },
    ...(level >= 1 ? [{ label: "Salary", to: { kind: "domain", id: "salary" } as Sel }] : []),
    ...(topicSel ? [{ label: short(topicSel.topic), to: sel }] : []),
  ];
  const branchKey = `${level}-${topicSel?.topic.key ?? ""}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-20 text-[#161616]">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl">The {data.company} brain</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
          Everything the brain has read, as a mind map. Click Salary to open its topics, then a topic to see the documents behind it.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={`Mind map of ${data.company}`}>
            <defs>
              <filter id="lift" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* branches: drawn for the open level, fading in once the nodes have moved */}
            <g key={branchKey} className="mm-branches" fill="none" strokeWidth="1.5">
              {level === 0 && <circle cx={C.x} cy={C.y} r={RING} stroke="#161616" strokeOpacity="0.05" />}
              {level === 0 &&
                DOMAINS.map((d) => (
                  <path key={d.id} d={branch(C, domainPos(d))} stroke={d.id === "salary" ? "#1463ff" : "#e5e5e5"} strokeDasharray={d.live ? undefined : "3 6"} />
                ))}
              {level >= 1 && <path d={branch(company, salary)} stroke="#1463ff" />}
              {level === 1 && placed.map((p, i) => <path key={p.topic.key} d={branch(salary, topicPos(i))} stroke={hover === p.topic.key ? "#1463ff" : "#e5e5e5"} />)}
              {level === 2 && topicSel && (
                <>
                  {placed.map((p, i) => (p === topicSel ? null : <path key={p.topic.key} d={branch(salary, topicPos(i))} stroke="#f0f0f0" />))}
                  <path d={branch(salary, focus)} stroke="#1463ff" />
                  {topicSel.docs.map(({ doc }, i) => (
                    <path key={doc.path} d={branch(focus, docPos(i, topicSel.docs.length))} stroke={hover === doc.path ? "#1463ff" : "#e5e5e5"} />
                  ))}
                </>
              )}
            </g>

            {/* the other areas fold into the company when Salary opens */}
            {DOMAINS.filter((d) => d.id !== "salary").map((d) => (
              <g key={d.id} className="mm-node" style={{ ...at(domainPos(d)), opacity: level === 0 ? 1 : 0 }} pointerEvents={level === 0 ? "auto" : "none"}>
                <g {...bind({ kind: "domain", id: d.id }, d.live ? d.label : `${d.label}, not connected yet`)}>
                  <circle
                    r={d.live ? 34 : 22}
                    fill={d.live ? "#fff" : "#fafaf9"}
                    stroke={sel.kind === "domain" && sel.id === d.id ? "#1463ff" : d.live ? "#e5e5e5" : "#d4d4d4"}
                    strokeWidth="1.25"
                    strokeDasharray={d.live ? undefined : "3 4"}
                    filter={d.live ? "url(#lift)" : undefined}
                  />
                  <text y={d.live ? 4.5 : 22 + 18} textAnchor="middle" fontSize="13" fontWeight="500" fill={d.live ? "#161616" : "#a3a3a3"}>
                    {d.label}
                  </text>
                </g>
              </g>
            ))}

            {/* Salary's topics */}
            {placed.map((p, i) => {
              const pos = level === 2 && p === topicSel ? focus : topicPos(i);
              const color = STATUS[p.topic.status].color;
              const isOpen = p === topicSel;
              const hot = hover === p.topic.key;
              const visible = level === 1 || level === 2;
              const small = level === 2 && !isOpen;
              const r = isOpen ? 42 : small ? 6 : 10;
              return (
                <g key={p.topic.key} className="mm-node" style={{ ...at(pos), opacity: visible ? 1 : 0 }} pointerEvents={visible ? "auto" : "none"}>
                  <g {...bind({ kind: "topic", id: p.topic.key }, `${p.topic.label}: ${STATUS[p.topic.status].label}, ${p.docs.length} documents`, p.topic.key)}>
                    <circle r={Math.max(r, 14)} fill="transparent" />
                    <circle
                      r={r}
                      className="mm-size"
                      fill={isOpen ? color : `${color}1f`}
                      stroke={color}
                      strokeWidth={isOpen ? 0 : 1.5}
                      filter={isOpen ? "url(#lift)" : undefined}
                    />
                    {isOpen ? (
                      wrap(short(p.topic), 11).map((line, j, all) => (
                        <text key={j} y={4.5 + (j - (all.length - 1) / 2) * 15} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">
                          {line}
                        </text>
                      ))
                    ) : small ? (
                      hot && (
                        <text x={10} y={4} fontSize="12" fill="#161616">
                          {short(p.topic)}
                        </text>
                      )
                    ) : (
                      <>
                        <text x={20} y={5} fontSize="14" fontWeight={hot ? 600 : 500} fill="#161616">
                          {short(p.topic)}
                          <tspan dx="8" fontWeight="400" fill="#8a8a8a">
                            {p.topic.answer ?? STATUS[p.topic.status].label}
                          </tspan>
                        </text>
                      </>
                    )}
                  </g>
                </g>
              );
            })}

            {/* the open topic's documents */}
            {topicSel?.docs.map(({ doc }, i) => {
              const pos = docPos(i, topicSel.docs.length);
              const color = KIND[doc.kind].color;
              const hot = hover === doc.path;
              return (
                <g key={`${topicSel.topic.key}-${doc.path}`} className="mm-node" style={at(pos)}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${doc.title}, ${KIND[doc.kind].label}. Open document`}
                    className="brain-node mm-pop cursor-pointer outline-none"
                    style={{ animationDelay: `${120 + i * 50}ms` }}
                    onClick={() => setOpen(doc)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(doc))}
                    onMouseEnter={() => setHover(doc.path)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <circle r="22" fill="#fff" stroke={color} strokeWidth={hot ? 2.5 : 1.5} filter="url(#lift)" />
                    <text y="4" textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="0.03em" fill={color}>
                      {ABBR[doc.kind]}
                    </text>
                    {wrap(doc.title, 26).map((line, j) => (
                      <text key={j} x="32" y={-5 + j * 15} fontSize="13" fontWeight="500" fill="#161616" textDecoration={hot ? "underline" : undefined}>
                        {line}
                      </text>
                    ))}
                    <text x="32" y={wrap(doc.title, 26).length > 1 ? 26 : 12} fontSize="11.5" fill={color}>
                      {KIND[doc.kind].label}
                      {doc.date ? `, ${doc.date.slice(0, 4)}` : ""}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Salary */}
            <g className="mm-node" style={at(salary)}>
              <g {...bind({ kind: "domain", id: "salary" }, `Salary, ${placed.length} topics`)}>
                <circle r={level === 2 ? 30 : 42} className="mm-size" fill="#1463ff" filter="url(#lift)" />
                <text y="5" textAnchor="middle" fontSize={level === 2 ? 13 : 15} fontWeight="500" fill="#fff">
                  Salary
                </text>
                <text y={level === 2 ? 50 : 62} textAnchor="middle" fontSize="12" fill="#737373" style={{ opacity: level === 0 ? 1 : 0 }} className="mm-fade">
                  {placed.length} topics, {data.documents.length} documents
                </text>
              </g>
            </g>

            {/* the company */}
            <g className="mm-node" style={at(company)}>
              <g {...bind({ kind: "company" }, data.company)}>
                <circle r={companyR} className="mm-size" fill="#161616" filter="url(#lift)" />
                <text y={level === 0 ? 10 : 5} textAnchor="middle" fontSize={level === 0 ? 30 : 14} fill="#fff" className="font-serif">
                  {data.company}
                </text>
              </g>
            </g>
          </svg>

          <nav aria-label="Map level" className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1">
                {i > 0 && <span className="text-neutral-300">›</span>}
                <button onClick={() => setSel(c.to)} className={i === crumbs.length - 1 ? "font-medium" : "text-neutral-500 hover:text-neutral-900"}>
                  {c.label}
                </button>
              </span>
            ))}
          </nav>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-5 text-xs text-neutral-500">
            {level === 2
              ? (["PDF", "Policy", "Guide", "Official", "SharePoint", "Confluence", "Email", "Teams", "Newsletter"] as DocKind[])
                  .filter((k) => topicSel?.docs.some((d) => d.doc.kind === k))
                  .map((k) => (
                    <li key={k} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: KIND[k].color }} />
                      {KIND[k].label}
                    </li>
                  ))
              : (["trusted", "conflict", "stale", "orphan"] as Status[]).map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].color }} />
                    {STATUS[s].label}
                  </li>
                ))}
          </ul>
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:max-h-[640px] lg:overflow-y-auto" aria-live="polite">
          <Panel sel={sel} data={data} placed={placed} onSelect={setSel} onOpen={setOpen} />
        </aside>
      </section>

      <Pipeline data={data} />

      {open && <Viewer doc={open} scores={data.scores} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Panel({ sel, data, placed, onSelect, onOpen }: { sel: Sel; data: BrainData; placed: Placed[]; onSelect: (s: Sel) => void; onOpen: (d: Doc) => void }) {
  if (sel.kind === "company") {
    const n = (s: Status[]) => data.topics.filter((t) => s.includes(t.status)).length;
    return (
      <>
        <Title kicker="Company" title={data.company} />
        <p className="text-sm leading-relaxed text-neutral-600">
          The brain has read {data.documents.length} documents across {placed.length} salary topics. The other subjects fill in once their sources are connected.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Big n={n(["trusted"])} label="trusted answers" color={STATUS.trusted.color} />
          <Big n={n(["conflict", "stale", "orphan"])} label="need a check" color={STATUS.conflict.color} />
        </div>
        <List>
          {DOMAINS.map((d) => (
            <Row key={d.id} onClick={() => onSelect({ kind: "domain", id: d.id })} right={d.live ? (d.id === "salary" ? `${placed.length} topics` : "Connected") : "Empty"} muted={!d.live}>
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
        ? placed.map(({ topic: t, docs }) => (
            <Row key={t.key} onClick={() => onSelect({ kind: "topic", id: t.key })} dot={STATUS[t.status].color} right={t.answer ?? "–"}>
              {short(t)}
              <span className="ml-1.5 text-xs text-neutral-400">{docs.length}</span>
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
        <p className="text-sm text-neutral-600">{d.id === "salary" ? `${placed.length} topics. The number is how many documents each has.` : d.blurb}</p>
        <List>{rows}</List>
      </>
    );
  }

  const p = placed.find((x) => x.topic.key === sel.id)!;
  const t = p.topic;
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

      <h3 className="mt-6 text-xs text-neutral-400">Documents ({p.docs.length})</h3>
      {p.docs.length === 0 && <p className="mt-2 text-sm text-neutral-500">No source files yet. This topic runs on example claims.</p>}
      <ul className="mt-1 divide-y divide-neutral-100">
        {p.docs.map(({ doc }) => {
          const claim = doc.claims.find((c) => t.claims.some((x) => x.id === c.id));
          const s = claim ? data.scores[claim.id] : undefined;
          return (
            <li key={doc.path}>
              <button onClick={() => onOpen(doc)} className="block w-full rounded-lg px-1.5 py-2 text-left text-sm transition hover:bg-neutral-50">
                <div className="flex items-center gap-2">
                  <KindBadge kind={doc.kind} />
                  <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-neutral-500">
                  <span className="truncate">{[doc.author, doc.date].filter(Boolean).join(", ")}</span>
                  {claim && (
                    <span className="shrink-0">
                      <span className="font-medium text-neutral-800">{claim.value}</span>
                      {s && <TrustTag score={s.score} excluded={s.excluded} />}
                    </span>
                  )}
                </div>
              </button>
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
