"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatServerError } from "@/lib/format-server-error";

type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  [key: string]: unknown;
};

type PromoteResult = {
  ok: boolean;
  lowerName: string;
  upperName: string;
  isFinalHop: boolean;
  failures: unknown[];
  dryRun: boolean;
};

type ConfirmResult = { lowerName: string; upperName: string };

type BacksyncResult = {
  lowerName: string;
  upperName: string;
  dryRun: boolean;
  synced: number;
  pending: number;
  conflicts: { lowerId: string; upperId: string; docType: string; lastSyncedAt: string }[];
  deletedOnOneSide: { lowerId: string; upperId: string; docType: string; deletedSide: "lower" | "upper" }[];
  hadIssues: boolean;
};

type EnvironmentsResponse = { chain: string[]; configured: string[] };

type LowerDocument = {
  id: string;
  uid: string | null;
  type: string;
  lang: string;
  title: string;
  predictedAction: "create" | "update" | "unchanged";
};

const predictedActionBadge: Record<LowerDocument["predictedAction"], { label: string; className: string }> = {
  create: { label: "NEW", className: "text-success bg-success-weak" },
  update: { label: "CHANGED", className: "text-accent bg-accent-weak" },
  unchanged: { label: "UNCHANGED", className: "text-text-dim bg-panel-2" },
};

const levelClass: Record<LogEntry["level"], string> = {
  info: "text-accent",
  warn: "text-warning",
  error: "text-danger",
};

const selectClass =
  "bg-panel-2 border border-border rounded-control py-1.5 px-2.5 text-[12.5px] text-text " +
  "cursor-pointer transition-colors enabled:hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-control px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap " +
  "transition-colors enabled:active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer";
const btnSecondary = `${btnBase} border border-border bg-panel-2 text-text enabled:hover:border-accent enabled:hover:text-accent`;
const btnPrimary = `${btnBase} border border-accent bg-accent text-white enabled:hover:brightness-110`;

export default function MigrationsClient() {
  const [chain, setChain] = useState<string[]>([]);
  const [configured, setConfigured] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [promoteResult, setPromoteResult] = useState<PromoteResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [backsyncResult, setBacksyncResult] = useState<BacksyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [documents, setDocuments] = useState<LowerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLang, setSelectedLang] = useState(""); // "" = every locale

  useEffect(() => {
    fetch("/api/migrations/environments")
      .then((r) => r.json())
      .then((data: EnvironmentsResponse) => {
        setChain(data.chain);
        setConfigured(data.configured);
        if (data.chain.length >= 2) {
          setFrom(data.chain[0]);
          setTo(data.chain[1]);
        }
      })
      .catch((err) => setErrorMsg(`Couldn't load environment chain: ${String(err)}`));
  }, []);

  // Document ids (and languages) belong to whichever repo `from`
  // currently points at — a stale selection from a different `from`
  // would silently apply to the wrong environment, so clear it whenever
  // from/to change, and reload the (cheap, ~dozens of rows) document
  // list eagerly so the language dropdown is populated without requiring
  // the picker to have been opened first.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedLang("");
    setDocuments([]);
    setDocsError(null);
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function loadDocuments() {
    if (!from || !to) return;
    setDocsLoading(true);
    setDocsError(null);
    fetch(`/api/migrations/documents?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data: { documents: LowerDocument[] }) => setDocuments(data.documents))
      .catch((err) => setDocsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDocsLoading(false));
  }

  function togglePicker() {
    setShowPicker((prev) => !prev);
  }

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const availableLangs = Array.from(new Set(documents.map((d) => d.lang))).sort();

  const filteredDocuments = documents.filter((doc) => {
    if (selectedLang && doc.lang !== selectedLang) return false;
    if (!docFilter.trim()) return true;
    const q = docFilter.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.type.toLowerCase().includes(q) ||
      doc.id.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  useEffect(() => {
    // Close any open stream if the component unmounts mid-run — the
    // migration itself still finishes server-side either way.
    return () => esRef.current?.close();
  }, []);

  function startStream(url: string, onDone: (data: unknown) => void) {
    setLines([]);
    setPromoteResult(null);
    setConfirmResult(null);
    setBacksyncResult(null);
    setErrorMsg(null);
    setRunning(true);

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("log", (e) => {
      setLines((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
    });
    es.addEventListener("done", (e) => {
      onDone(JSON.parse((e as MessageEvent).data));
      setRunning(false);
      es.close();
    });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      setErrorMsg(data ? formatServerError(JSON.parse(data)) : "Connection to the server was lost.");
      setRunning(false);
      es.close();
    });
  }

  function runPromote() {
    if (!from || !to) return;
    const onlyCount = selectedIds.size;
    // Picking specific documents already implies which locale they're
    // in, so it takes precedence over the language dropdown — same
    // precedence the backend applies (see phase2-migrate.ts).
    const langScope = onlyCount === 0 && selectedLang ? selectedLang : null;
    if (!dryRun) {
      const scope =
        onlyCount > 0
          ? `${onlyCount} selected document(s)`
          : langScope
            ? `every "${langScope}" document`
            : "the entire content library";
      const ok = window.confirm(
        `This will write real content into "${to}" (${scope}). This is NOT a dry run.\n\nContinue?`,
      );
      if (!ok) return;
    }
    let url = `/api/migrations/promote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&dryRun=${dryRun}`;
    if (onlyCount > 0) {
      url += `&only=${encodeURIComponent(Array.from(selectedIds).join(","))}`;
    } else if (langScope) {
      url += `&lang=${encodeURIComponent(langScope)}`;
    }
    startStream(url, (data) => setPromoteResult(data as PromoteResult));
  }

  function runConfirm() {
    if (!from || !to) return;
    const ok = window.confirm(
      `Only run this after you've published the Migration Release in "${to}"'s Prismic dashboard.\n\nHave you already published it?`,
    );
    if (!ok) return;
    const url = `/api/migrations/confirm?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    startStream(url, (data) => setConfirmResult(data as ConfirmResult));
  }

  function runBacksync() {
    if (!from || !to) return;
    // Backsync is the opposite direction from promote: --from must be
    // the UPPER environment. The same From/To dropdowns serve both
    // directions — no separate fields — the backend rejects a
    // wrong-direction pair with a clear error rather than this needing
    // to duplicate that direction logic here.
    if (!dryRun) {
      const ok = window.confirm(
        `This will write real content into "${to}" from "${from}" (ongoing back-sync). This is NOT a dry run.\n\nContinue?`,
      );
      if (!ok) return;
    }
    const url = `/api/migrations/backsync?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&dryRun=${dryRun}`;
    startStream(url, (data) => setBacksyncResult(data as BacksyncResult));
  }

  return (
    <div className="max-w-[900px] mx-auto px-5 pt-8 pb-16">
      <p className="text-[11px] font-bold tracking-wider uppercase text-accent mb-1">admin-app</p>
      <h1 className="font-display text-[22px] font-extrabold tracking-tight mb-1.5 text-balance">
        Prismic migrations
      </h1>
      <p className="text-text-dim mb-6 text-[13px] leading-relaxed">
        Runs the same preflight + assets + migrate hop as{" "}
        <code>pnpm cli promote --from=... --to=...</code>, live, without a terminal.{" "}
        <Link href="/history" className="text-accent underline">
          Past runs →
        </Link>
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3.5 p-4.5 bg-panel border border-border rounded-card shadow-subtle mb-5 max-sm:flex-col max-sm:items-stretch">
        <Field label="From">
          <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={running} className={selectClass}>
            {chain.map((env) => (
              <option key={env} value={env} disabled={!configured.includes(env)}>
                {env}
                {!configured.includes(env) ? " (not configured)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To">
          <select value={to} onChange={(e) => setTo(e.target.value)} disabled={running} className={selectClass}>
            {chain.map((env) => (
              <option key={env} value={env} disabled={!configured.includes(env)}>
                {env}
                {!configured.includes(env) ? " (not configured)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-1.5 text-[12.5px] pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={running}
            className="size-3.5 accent-accent cursor-pointer"
          />
          Dry run (log the plan, write nothing)
        </label>
        <Field label="Language">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            disabled={running || selectedIds.size > 0 || availableLangs.length === 0}
            title={
              selectedIds.size > 0
                ? "Ignored while specific documents are selected below"
                : undefined
            }
            className={selectClass}
          >
            <option value="">All</option>
            {availableLangs.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={togglePicker} disabled={running || !from || !to} className={btnSecondary}>
          {selectedIds.size > 0
            ? `${selectedIds.size} document(s) selected`
            : "Specific documents (optional)"}
        </button>
        <div className="flex-1 min-w-2 max-sm:hidden" />
        <button onClick={runConfirm} disabled={running || !from || !to} className={btnSecondary}>
          Confirm (after publish)
        </button>
        <button onClick={runBacksync} disabled={running || !from || !to} className={btnSecondary}>
          {dryRun ? "Backsync dry run" : "Run backsync"}
        </button>
        <button onClick={runPromote} disabled={running || !from || !to} className={btnPrimary}>
          {running
            ? "Running…"
            : `${dryRun ? "Run dry run" : "Run promote hop"}${
                selectedIds.size > 0
                  ? ` (${selectedIds.size} doc${selectedIds.size === 1 ? "" : "s"})`
                  : selectedLang
                    ? ` (${selectedLang} only)`
                    : ""
              }`}
        </button>
      </div>

      {/* Document picker */}
      {showPicker && (
        <div className="bg-panel border border-border rounded-card shadow-subtle p-4.5 mb-5">
          <div className="flex justify-between items-center gap-3 mb-2.5">
            <p className="m-0 text-[12.5px] text-text-dim leading-relaxed">
              Migrate only the checked document(s) from <strong>{from}</strong> — leave nothing
              checked to migrate the whole content library (or everything in the Language filter
              above, if one&apos;s set), same as before.
            </p>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} className={`${btnSecondary} !px-2.5 !py-1 !text-[11px]`}>
                Clear selection
              </button>
            )}
          </div>

          {docsLoading && <p className="text-text-dim text-[13px]">Loading documents…</p>}
          {docsError && (
            <p className="text-danger text-[13px]">
              Couldn&apos;t load documents: {docsError}{" "}
              <button onClick={loadDocuments} className={`${btnSecondary} !px-2 !py-0.5`}>
                Retry
              </button>
            </p>
          )}

          {!docsLoading && !docsError && documents.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Filter by title, type, or id…"
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="w-full px-3 py-2 mb-2 border border-border rounded-control text-[12.5px] bg-panel-2 text-text transition-colors hover:border-accent focus:border-accent"
              />
              <div className="max-h-[280px] overflow-y-auto border border-border rounded-control">
                {filteredDocuments.map((doc) => (
                  <label
                    key={doc.id}
                    className="grid grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1fr)_auto] max-sm:grid-cols-[18px_1fr] items-center gap-2.5 px-3 py-2 text-[12.5px] border-b border-border last:border-b-0 cursor-pointer hover:bg-panel-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="size-3.5 accent-accent cursor-pointer max-sm:row-start-1 max-sm:col-start-1"
                    />
                    <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-sm:row-start-1 max-sm:col-start-2">
                      {doc.title}
                    </span>
                    <span className="text-text-dim overflow-hidden text-ellipsis whitespace-nowrap max-sm:row-start-2 max-sm:col-start-2">
                      {doc.type} · {doc.lang}
                    </span>
                    <span className="flex items-center gap-2 justify-self-end max-sm:row-start-3 max-sm:col-start-2 max-sm:justify-self-start">
                      <span
                        className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${predictedActionBadge[doc.predictedAction].className}`}
                      >
                        {predictedActionBadge[doc.predictedAction].label}
                      </span>
                      <code className="text-[11px]">{doc.id}</code>
                    </span>
                  </label>
                ))}
                {filteredDocuments.length === 0 && (
                  <p className="p-2.5 text-text-dim text-[12.5px] m-0">
                    No documents match &quot;{docFilter}&quot;.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="bg-danger-weak text-danger border border-danger rounded-card px-4 py-2.5 mb-4 text-[13px]">
          {errorMsg}
        </div>
      )}

      {/* Live log */}
      {(lines.length > 0 || running) && (
        <div className="bg-panel-2 border border-border rounded-card p-3 mb-5 max-h-[340px] overflow-auto font-mono text-xs">
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid grid-cols-[82px_48px_minmax(0,auto)_minmax(0,1fr)] gap-2.5 items-baseline py-0.5"
            >
              <span className="text-text-dim">{new Date(line.ts).toLocaleTimeString()}</span>
              <span className={`font-bold ${levelClass[line.level]}`}>{line.level.toUpperCase()}</span>
              <span className="font-semibold">{line.event}</span>
              <span className="text-text-dim overflow-hidden text-ellipsis whitespace-nowrap">
                {Object.entries(line)
                  .filter(([k]) => !["ts", "level", "event"].includes(k))
                  .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                  .join("  ")}
              </span>
            </div>
          ))}
          {running && <div className="text-text-dim py-0.5">Running…</div>}
          <div ref={logEndRef} />
        </div>
      )}

      {promoteResult && (
        <ResultCard>
          <strong className="font-display">
            {promoteResult.lowerName} → {promoteResult.upperName}{" "}
            {promoteResult.ok
              ? promoteResult.dryRun
                ? "— dry run complete"
                : "— hop complete"
              : "— had failures"}
          </strong>
          {promoteResult.failures.length > 0 && (
            <p className="text-danger mt-1.5">
              {promoteResult.failures.length} failure(s) — see the log above for detail.
            </p>
          )}
          {promoteResult.ok && !promoteResult.dryRun && (
            <p className="mt-2">
              Next: publish the Migration Release in <strong>{promoteResult.upperName}</strong>
              &apos;s Prismic dashboard, then use <strong>Confirm</strong> above.
              {!promoteResult.isFinalHop && (
                <>
                  {" "}
                  Then continue promoting from <code>{promoteResult.upperName}</code>.
                </>
              )}
            </p>
          )}
        </ResultCard>
      )}

      {confirmResult && (
        <ResultCard>
          <strong className="font-display">
            {confirmResult.lowerName} → {confirmResult.upperName} confirmed synced.
          </strong>
        </ResultCard>
      )}

      {backsyncResult && (
        <ResultCard tone={backsyncResult.hadIssues ? "warning" : "success"}>
          <strong className="font-display">
            {backsyncResult.upperName} → {backsyncResult.lowerName}{" "}
            {backsyncResult.dryRun ? "— dry run complete" : "— back-sync complete"}
          </strong>
          <p className="mt-1.5">
            {backsyncResult.synced} synced, {backsyncResult.pending} still pending.
          </p>
          {backsyncResult.conflicts.length > 0 && (
            <p className="text-warning mt-1.5">
              {backsyncResult.conflicts.length} conflict(s) need a human decision — not
              auto-resolved. See the log above for each document.
            </p>
          )}
          {backsyncResult.deletedOnOneSide.length > 0 && (
            <p className="text-warning mt-1.5">
              {backsyncResult.deletedOnOneSide.length} document(s) deleted on only one side —
              decide by hand whether to `unlink` or recreate them.
            </p>
          )}
        </ResultCard>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px]">
      <span className="text-text-dim uppercase tracking-wide font-semibold">{label}</span>
      {children}
    </label>
  );
}

const resultCardTone = {
  success: "bg-success-weak border-success",
  warning: "bg-warning-weak border-warning",
};

function ResultCard({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <div
      className={`border rounded-card shadow-subtle px-4.5 py-4 text-[13px] leading-relaxed ${resultCardTone[tone]}`}
    >
      {children}
    </div>
  );
}
