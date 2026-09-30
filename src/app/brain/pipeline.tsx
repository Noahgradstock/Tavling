"use client";

import type { ReactNode } from "react";
import { Flag } from "@/lib/demo-shared";
import { DatabaseLogo, DocsLogo, GmailLogo, OutlookLogo, TeamsLogo } from "../logos";
import type { BrainData } from "./brain-map";

// How the brain reads: connect → find → scan → extract, in one calm row above the documents.

type Channel = BrainData["channels"][number]["type"];
const SOURCES: { name: string; type: Channel | null; logo: ReactNode }[] = [
  { name: "Teams", type: "teams", logo: <TeamsLogo /> },
  { name: "Outlook", type: "email", logo: <OutlookLogo /> },
  { name: "Gmail", type: "email", logo: <GmailLogo /> },
  { name: "Database", type: null, logo: <DatabaseLogo /> },
  { name: "SharePoint", type: "sharepoint", logo: <DocsLogo /> },
  { name: "EU law", type: "official", logo: <Flag country="EU" size={16} /> },
  { name: "BE law", type: "official", logo: <Flag country="BE" size={16} /> },
];

export default function Pipeline({ data }: { data: BrainData }) {
  const count = (t: Channel | null) => (t ? (data.channels.find((c) => c.type === t)?.claims ?? 0) : 0);
  // A real example: the best-scored statement on the sick leave relapse question.
  const example = data.topics
    .find((t) => t.key === "sick-relapse")
    ?.claims.filter((c) => c.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const author = example?.author ? data.people.find((p) => p.id === example.author)?.name : "Official publication";

  return (
    <section className="mt-16">
      <h2 className="font-serif text-4xl leading-none">How the brain reads</h2>
      <p className="mt-2 text-sm text-neutral-500">It connects to where knowledge lives, finds every document, reads it for what matters, and passes on who said what.</p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-4">
        <Step n={1} title="Connects" text="Read-only, with each user's own access.">
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-1" title={`${s.name}: ${count(s.type)} statements`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6f5f2] [&>svg:not([aria-label])]:h-6 [&>svg:not([aria-label])]:w-6">{s.logo}</div>
                <span className="text-[10px] text-neutral-500">{s.name}</span>
              </div>
            ))}
          </div>
        </Step>

        <Step n={2} title="Finds" text="Every document that mentions the topic.">
          <div className="flex items-end gap-3">
            <div className="relative h-12 w-10">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute h-11 w-8 rounded-[4px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                  style={{ left: i * 4, top: (2 - i) * 2 }}
                />
              ))}
            </div>
            <div>
              <div className="font-serif text-4xl leading-none">{data.documents.length}</div>
              <div className="text-[11px] text-neutral-500">documents</div>
            </div>
          </div>
        </Step>

        <Step n={3} title="Scans" text="Reads each one for the line that answers the question.">
          <div className="relative overflow-hidden rounded-lg bg-[#f6f5f2] p-2.5 text-[10.5px] leading-relaxed text-neutral-500">
            <span className="scan-line absolute inset-x-0 h-[2px] bg-[#1463ff] shadow-[0_0_10px_rgba(20,99,255,0.5)]" />…a new illness within{" "}
            <mark className="rounded-sm bg-[#cfe0ff] px-0.5 text-[#161616]">{example?.value ?? "8 weeks"}</mark> after returning to work counts as the
            same illness…
          </div>
        </Step>

        <Step n={4} title="Extracts" text="What it says, who said it and when, sent to the trust check.">
          {example && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-[#f6f5f2] p-2.5 text-[11px]">
              <dt className="text-neutral-400">Says</dt>
              <dd className="font-medium">{example.value}</dd>
              <dt className="text-neutral-400">Who</dt>
              <dd className="truncate">{author}</dd>
              <dt className="text-neutral-400">When</dt>
              <dd>{example.date}</dd>
            </dl>
          )}
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="relative flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">0{n}</div>
        <div className="mt-0.5 text-sm font-medium">{title}</div>
        <div className="text-xs text-neutral-500">{text}</div>
      </div>
      <div className="mt-auto">{children}</div>
      {n < 4 && (
        <span className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#f3f1ec] text-[11px] text-neutral-400 sm:flex">
          →
        </span>
      )}
    </li>
  );
}
