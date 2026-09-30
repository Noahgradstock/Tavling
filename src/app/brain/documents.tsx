"use client";

import { useEffect, useRef, useState } from "react";
import type { Doc, DocKind } from "@/lib/documents";

// How each source document looks: a paper page, an email, a Teams thread or the newsletter itself.
// Rendered at a fixed page width; zoom scales it for thumbnails and the viewer.

export type ClaimScores = Record<string, { score: number | null; excluded: string | null }>;

const PAGE_W = 680;

export const KIND: Record<DocKind, { label: string; color: string }> = {
  PDF: { label: "PDF", color: "#c62a30" },
  Policy: { label: "Policy", color: "#161616" },
  Official: { label: "Official", color: "#161616" },
  SharePoint: { label: "SharePoint", color: "#0f7b6c" },
  Confluence: { label: "Confluence", color: "#1868db" },
  Email: { label: "Email", color: "#1463ff" },
  Teams: { label: "Teams", color: "#5b5fc7" },
  Newsletter: { label: "Newsletter", color: "#b45309" },
};

export function KindBadge({ kind }: { kind: DocKind }) {
  const k = KIND[kind];
  return (
    <span className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ color: k.color, background: `${k.color}12` }}>
      {k.label}
    </span>
  );
}

const fmtDate = (iso: string | null) =>
  iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function DocPage({ doc, interactive = true }: { doc: Doc; interactive?: boolean }) {
  const b = doc.body;
  if (b.type === "html") return <HtmlPage html={b.html} interactive={interactive} />;

  return (
    <div className="bg-white text-[#161616]" style={{ width: PAGE_W, minHeight: PAGE_W * 1.3 }}>
      {b.type === "text" && (
        <div className={`whitespace-pre-wrap px-14 py-14 ${b.mono ? "font-mono text-[12px] leading-[1.6]" : "text-[14px] leading-[1.7]"}`}>{b.text}</div>
      )}

      {b.type === "email" && (
        <div className="px-12 py-10">
          <h1 className="text-[22px] font-semibold leading-snug">{b.subject}</h1>
          <dl className="mt-5 grid grid-cols-[56px_1fr] gap-y-1 border-b border-neutral-200 pb-5 text-[13px]">
            <dt className="text-neutral-400">From</dt>
            <dd>{b.from}</dd>
            <dt className="text-neutral-400">To</dt>
            <dd>{b.to}</dd>
            {b.cc && (
              <>
                <dt className="text-neutral-400">Cc</dt>
                <dd>{b.cc}</dd>
              </>
            )}
            <dt className="text-neutral-400">Date</dt>
            <dd>{b.date}</dd>
          </dl>
          <div className="mt-6 whitespace-pre-wrap text-[14px] leading-[1.7]">{b.text}</div>
        </div>
      )}

      {b.type === "chat" && (
        <div className="px-10 py-8">
          <div className="border-b border-neutral-200 pb-4 text-[15px] font-semibold">
            <span className="text-[#5b5fc7]">Teams</span> {b.channel}
          </div>
          <ul className="mt-2">
            {b.messages.map((m, i) => (
              <li key={i} className={`flex gap-3 py-3 ${m.reply ? "ml-11" : ""}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5b5fc7]/10 text-[11px] font-semibold text-[#5b5fc7]">
                  {initials(m.author)}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px]">
                    <span className="font-semibold">{m.author}</span> <span className="text-neutral-400">{fmtDate(m.date)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-[1.6]">{m.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The newsletter is real HTML: shown as-is in a sandboxed frame (no scripts), sized to its content.
function HtmlPage({ html, interactive }: { html: string; interactive: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(PAGE_W * 1.3);
  return (
    <iframe
      ref={ref}
      title="Newsletter"
      srcDoc={html}
      sandbox="allow-same-origin"
      tabIndex={interactive ? 0 : -1}
      onLoad={() => {
        const h = ref.current?.contentDocument?.documentElement.scrollHeight;
        if (h) setHeight(h);
      }}
      className="block border-0 bg-white"
      style={{ width: PAGE_W, height }}
    />
  );
}

// A live miniature of the first page.
export function Thumb({ doc }: { doc: Doc }) {
  return (
    <div className="pointer-events-none relative aspect-[4/5] overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]" aria-hidden>
      <div style={{ zoom: 0.36 }}>
        <DocPage doc={doc} interactive={false} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

export function DocCard({ doc, scores, onOpen }: { doc: Doc; scores: ClaimScores; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group flex flex-col gap-3 rounded-2xl p-2 text-left transition hover:bg-white focus-visible:outline-2 focus-visible:outline-[#1463ff]">
      <div className="transition group-hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <Thumb doc={doc} />
      </div>
      <div className="px-1">
        <div className="flex items-center gap-2">
          <KindBadge kind={doc.kind} />
          <span className="truncate text-xs text-neutral-400">{fmtDate(doc.date)}</span>
        </div>
        <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{doc.title}</div>
        <ClaimLine doc={doc} scores={scores} />
      </div>
    </button>
  );
}

// What the brain took from the document, with how much it trusts it.
function ClaimLine({ doc, scores }: { doc: Doc; scores: ClaimScores }) {
  const c = doc.claims[0];
  if (!c) return <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{doc.excerpt}</p>;
  const s = scores[c.id];
  return (
    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
      Says <span className="font-medium text-neutral-800">{c.value}</span>
      {doc.claims.length > 1 && ` and ${doc.claims.length - 1} more`}
      {s && <TrustTag score={s.score} excluded={s.excluded} />}
    </p>
  );
}

export function TrustTag({ score, excluded }: { score: number | null; excluded: string | null }) {
  if (excluded) return <span className="ml-1.5 text-neutral-400">other client</span>;
  if (score === null) return null;
  const color = score >= 0.75 ? "#1463ff" : score >= 0.5 ? "#d97706" : "#c62a30";
  return (
    <span className="ml-1.5 tabular-nums" style={{ color }}>
      {Math.round(score * 100)}% trusted
    </span>
  );
}

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

export function Viewer({ doc, scores, onClose }: { doc: Doc; scores: ClaimScores; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const area = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const step = (dir: 1 | -1) =>
    setZoom((z) => (dir > 0 ? ZOOMS.find((x) => x > z + 0.01) ?? z : [...ZOOMS].reverse().find((x) => x < z - 0.01) ?? z));
  const fit = () => area.current && setZoom(Math.min(2, Math.max(0.4, (area.current.clientWidth - 64) / PAGE_W)));

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") step(1);
      else if (e.key === "-") step(-1);
      else if (e.key === "0") setZoom(1);
    };
    // Pinch on a trackpad (or ctrl + scroll) zooms the page instead of the browser.
    const el = area.current;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(0.3, z * Math.exp(-e.deltaY / 200))));
    };
    window.addEventListener("keydown", onKey);
    el?.addEventListener("wheel", onWheel, { passive: false });
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("wheel", onWheel);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/30 p-0 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-[#f3f1ec] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-3">
          <KindBadge kind={doc.kind} />
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</div>
          <div className="flex items-center rounded-full bg-neutral-100 p-0.5 text-sm">
            <ZoomBtn label="Zoom out" onClick={() => step(-1)}>
              −
            </ZoomBtn>
            <button onClick={() => setZoom(1)} className="w-14 text-center text-xs tabular-nums text-neutral-600" aria-label="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <ZoomBtn label="Zoom in" onClick={() => step(1)}>
              +
            </ZoomBtn>
          </div>
          <button onClick={fit} className="hidden rounded-full px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 sm:block">
            Fit width
          </button>
          <button ref={closeBtn} onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div ref={area} className="min-w-0 flex-1 overflow-auto bg-[#e7e5e0]">
            <div className="flex min-w-fit justify-center p-8">
              <div className="shadow-[0_2px_20px_-6px_rgba(0,0,0,0.25)]" style={{ zoom }}>
                <DocPage doc={doc} />
              </div>
            </div>
          </div>

          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-black/[0.06] bg-white p-5 lg:block">
            <h2 className="font-serif text-2xl leading-tight">Summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{doc.excerpt}</p>
            {doc.claims.length > 0 && (
              <>
                <h3 className="mt-6 text-xs text-neutral-400">What the brain took from it</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {doc.claims.map((c) => (
                    <li key={c.id} className="rounded-xl bg-neutral-50 p-3">
                      <div className="font-serif text-2xl leading-none">{c.value}</div>
                      <div className="mt-1.5 text-xs text-neutral-500">{c.fact}</div>
                      <div className="mt-1 text-xs">
                        <TrustTag {...(scores[c.id] ?? { score: null, excluded: null })} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <dl className="mt-6 grid grid-cols-[64px_1fr] gap-y-1.5 text-xs">
              {doc.author && (
                <>
                  <dt className="text-neutral-400">Author</dt>
                  <dd>{doc.author}</dd>
                </>
              )}
              {doc.date && (
                <>
                  <dt className="text-neutral-400">Date</dt>
                  <dd>{fmtDate(doc.date)}</dd>
                </>
              )}
              <dt className="text-neutral-400">File</dt>
              <dd className="break-all text-neutral-600">{doc.path}</dd>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-700 hover:bg-white">
      {children}
    </button>
  );
}
