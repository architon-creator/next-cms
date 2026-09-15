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
  created: number;
  updated: number;
  unchanged: number;
  hasPendingRelease: boolean;
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

type VerifyResult = {
  lowerName: string;
  upperName: string;
  report: {
    passed: boolean;
    countCheck: { lowerCount: number; upperCount: number; matches: boolean };
    spotCheck: { sampleSize: number; mismatches: string[] };
    brokenLinkScan: { affectedDocuments: Record<string, string[]> };
    assetCheck: { affectedDocuments: Record<string, string[]> };
    deletedDocuments: { lowerId: string; upperId: string; deletedSide: "lower" | "upper" }[];
    deletedAssets: { lowerAssetId: string; upperAssetId: string }[];
  };
};

type InspectResult = {
  lowerName: string;
  upperName: string;
  lowerId: string;
  upperId: string;
  lowerDoc: { data: Record<string, unknown> };
  upperDoc: { data: Record<string, unknown> } | null;
  matches?: boolean;
  differingKeys: string[];
};

type ReconcileResult = {
  lowerName: string;
  upperName: string;
  dryRun: boolean;
  reconciled: number;
  ambiguous: { lowerId: string; docType: string; lang: string; matchCount: number }[];
  notFound: { lowerId: string; docType: string; lang: string }[];
  failed: { lowerId: string; docType: string; message: string; status?: number; body?: string }[];
};

type PairStatus = {
  lowerName: string;
  upperName: string;
  configured: boolean;
  counts: { synced: number; pending: number; conflict: number; total: number };
};

type EnvironmentsResponse = { chain: string[]; configured: string[]; pairStatuses: PairStatus[] };

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
  const [pairStatuses, setPairStatuses] = useState<PairStatus[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [promoteResult, setPromoteResult] = useState<PromoteResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [backsyncResult, setBacksyncResult] = useState<BacksyncResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
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

  const [inspectOpenId, setInspectOpenId] = useState<string | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);

  function toggleInspect(lowerId: string) {
    if (inspectOpenId === lowerId) {
      setInspectOpenId(null);
      return;
    }
    setInspectOpenId(lowerId);
    setInspectResult(null);
    setInspectError(null);
    setInspectLoading(true);
    fetch(
      `/api/migrations/inspect?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&lowerId=${encodeURIComponent(lowerId)}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data: InspectResult) => setInspectResult(data))
      .catch((err) => setInspectError(err instanceof Error ? err.message : String(err)))
      .finally(() => setInspectLoading(false));
  }

  useEffect(() => {
    fetch("/api/migrations/environments")
      .then((r) => r.json())
      .then((data: EnvironmentsResponse) => {
        setChain(data.chain);
        setConfigured(data.configured);
        setPairStatuses(data.pairStatuses);
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
    // The document picker/language filter only ever support the forward
    // (lower -> upper) direction — used by Promote/Reconcile, not
    // Backsync. Attempting the fetch anyway when From/To is the reverse
    // pair (legitimate for Backsync) always fails with a "backward"
    // error from the API — that's correct, but showing it unprompted the
    // moment someone sets up a Backsync pair reads as a real problem
    // rather than the expected, quiet non-applicability it actually is.
    if (isForwardPair()) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // From and To must never end up the same environment — a hop against
  // itself is meaningless and every action (promote/verify/backsync/...)
  // would reject or no-op on it anyway. Rather than just blocking the
  // pick, auto-adjusts the OTHER dropdown to the nearest chain neighbor
  // so picking "sit" as From while To is already "sit" resolves to a
  // sensible pair (e.g. From=sit, To=dev) instead of silently allowing
  // From === To (confirmed possible via the raw <select>s, unlike the
  // chain-strip pills above which already only ever produce valid pairs).
  function handleFromChange(newFrom: string) {
    setFrom(newFrom);
    if (newFrom === to) {
      const idx = chain.indexOf(newFrom);
      setTo(chain[idx + 1] ?? chain[idx - 1] ?? to);
    }
  }

  function handleToChange(newTo: string) {
    setTo(newTo);
    if (newTo === from) {
      const idx = chain.indexOf(newTo);
      setFrom(chain[idx - 1] ?? chain[idx + 1] ?? from);
    }
  }

  function isForwardPair(): boolean {
    const fromIdx = chain.indexOf(from);
    const toIdx = chain.indexOf(to);
    return fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx;
  }

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
    setVerifyResult(null);
    setReconcileResult(null);
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

  function runVerify() {
    if (!from || !to) return;
    const url = `/api/migrations/verify?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    startStream(url, (data) => setVerifyResult(data as VerifyResult));
  }

  function runReconcile() {
    if (!from || !to) return;
    if (!dryRun) {
      const ok = window.confirm(
        `This will link some of "${from}"'s documents to pre-existing "${to}" documents (real write to the mapping file, not Prismic itself). Continue?`,
      );
      if (!ok) return;
    }
    const url = `/api/migrations/reconcile?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&dryRun=${dryRun}`;
    startStream(url, (data) => setReconcileResult(data as ReconcileResult));
  }

  return (
    <div className="max-w-[900px] mx-auto px-5 pt-8 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-[6px] bg-accent text-white flex items-center justify-center font-display font-extrabold text-[12px] shrink-0">
            P
          </div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-text-dim">
            Admin Console
          </span>
        </div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-dim no-underline transition-colors hover:text-accent"
        >
          Past runs <span aria-hidden="true">→</span>
        </Link>
      </div>

      <h1 className="font-display text-[24px] font-extrabold tracking-tight mb-1.5 text-balance">
        Prismic migrations
      </h1>
      <p className="text-text-dim mb-5 text-[13px] leading-relaxed max-w-[620px]">
        Runs the same preflight + assets + migrate hop as{" "}
        <code>pnpm cli promote --from=... --to=...</code>, live, without a terminal.
      </p>

      {chain.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 mb-6"
          aria-label="Environment chain — click a stage or hop to select it"
        >
          {chain.map((env, i) => {
            const isActiveEndpoint = env === from || env === to;
            const isConfigured = configured.includes(env);
            const nextEnv = chain[i + 1];
            const pair = nextEnv
              ? pairStatuses.find((p) => p.lowerName === env && p.upperName === nextEnv)
              : undefined;
            const isActiveHop = env === from && nextEnv === to;
            const hopDotClass =
              !pair || !pair.configured || pair.counts.total === 0
                ? "bg-text-dim/40"
                : pair.counts.conflict > 0
                  ? "bg-danger"
                  : pair.counts.pending > 0
                    ? "bg-warning"
                    : "bg-success";
            return (
              <div key={env} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (running || !isConfigured) return;
                    // Always keep From/To in lower->upper chain order — the
                    // clicked env becomes From if it has a next (upper)
                    // neighbor, otherwise (it's the last/highest stage) it
                    // becomes To with the previous (lower) stage as From.
                    // Picking "clicked env = From" unconditionally would
                    // produce a backward pair when clicking the chain's
                    // last stage (confirmed on a real run: clicking "sit"
                    // as the last configured stage gave From=sit, To=dev —
                    // backward, and broke document listing).
                    if (chain[i + 1]) {
                      setFrom(env);
                      setTo(chain[i + 1]);
                    } else if (chain[i - 1]) {
                      setFrom(chain[i - 1]);
                      setTo(env);
                    }
                  }}
                  disabled={running || !isConfigured}
                  title={
                    !isConfigured
                      ? `${env} isn't configured yet`
                      : chain[i + 1]
                        ? `Select "${env}" → "${chain[i + 1]}"`
                        : `Select "${chain[i - 1]}" → "${env}"`
                  }
                  className={
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors " +
                    (isActiveEndpoint
                      ? "bg-accent text-white border-accent"
                      : isConfigured
                        ? "bg-panel-2 text-text border-border cursor-pointer hover:border-accent hover:text-accent"
                        : "bg-panel-2 text-text-dim border-border border-dashed cursor-default")
                  }
                >
                  {env}
                </button>
                {nextEnv && (
                  <button
                    type="button"
                    onClick={() => {
                      if (running) return;
                      setFrom(env);
                      setTo(nextEnv);
                    }}
                    disabled={running}
                    title={
                      pair && pair.configured
                        ? `${pair.counts.synced} synced · ${pair.counts.pending} pending · ${pair.counts.conflict} conflict — click to select ${env} → ${nextEnv}`
                        : `Select ${env} → ${nextEnv}`
                    }
                    className={
                      "flex items-center gap-1 text-[12px] rounded-full px-1.5 py-0.5 transition-colors " +
                      (isActiveHop
                        ? "bg-accent-weak text-accent font-semibold"
                        : "text-text-dim hover:text-accent")
                    }
                  >
                    <span aria-hidden="true" className={`size-1.5 rounded-full shrink-0 ${hopDotClass}`} />
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3.5 p-4.5 bg-panel border border-border rounded-card shadow-subtle mb-5 max-sm:flex-col max-sm:items-stretch">
        <Field label="From">
          <select value={from} onChange={(e) => handleFromChange(e.target.value)} disabled={running} className={selectClass}>
            {chain.map((env) => (
              <option key={env} value={env} disabled={!configured.includes(env)}>
                {env}
                {!configured.includes(env) ? " (not configured)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To">
          <select value={to} onChange={(e) => handleToChange(e.target.value)} disabled={running} className={selectClass}>
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
      </div>

      {/* Workflow — left to right is the order you'd normally run these in;
          Backsync sits after a divider because it runs the opposite direction. */}
      <div className="flex flex-wrap items-stretch gap-3 p-4.5 bg-panel border border-border rounded-card shadow-subtle mb-5">
        <ActionButton
          eyebrow="Optional · before migrating"
          label={dryRun ? "Reconcile dry run" : "Run reconcile"}
          caption={`If some "${to || "target"}" documents already exist and just haven't been linked yet, run this first — it matches and links them instead of Promote creating duplicates.`}
          onClick={runReconcile}
          disabled={running || !from || !to}
        />
        <ActionButton
          eyebrow="Step 1 · migrate"
          label={
            running
              ? "Running…"
              : `${dryRun ? "Run dry run" : "Run promote hop"}${
                  selectedIds.size > 0
                    ? ` (${selectedIds.size} doc${selectedIds.size === 1 ? "" : "s"})`
                    : selectedLang
                      ? ` (${selectedLang} only)`
                      : ""
                }`
          }
          caption={`Copies content ${from || "from"} → ${to || "to"} into a draft Migration Release. Nothing goes live yet — you still publish that Release yourself in Prismic.`}
          onClick={runPromote}
          disabled={running || !from || !to}
          variant="primary"
        />
        <ActionButton
          eyebrow="Step 2 · after you publish"
          label="Confirm (after publish)"
          caption={`Run this only once you've manually published the Release in "${to || "target"}"'s Prismic dashboard — it marks those documents as synced here.`}
          onClick={runConfirm}
          disabled={running || !from || !to || dryRun}
          disabledReason={
            dryRun
              ? "Confirm always checks real, live sync state — it has no dry-run mode of its own. Uncheck \"Dry run\" above to use it."
              : undefined
          }
        />
        <ActionButton
          eyebrow="Anytime · check-only"
          label="Verify"
          caption="Compares both sides for count mismatches, broken links, and missing assets. Read-only — safe to run whenever you want a health check."
          onClick={runVerify}
          disabled={running || !from || !to}
        />
        <div className="w-px bg-border self-stretch mx-1 max-sm:hidden" />
        <ActionButton
          eyebrow="Ongoing · reverse direction"
          label={dryRun ? "Backsync dry run" : "Run backsync"}
          caption={`For edits made directly on "${from || "the upper env"}" — pulls them back down into "${to || "the lower env"}". Opposite direction from Promote, same From/To dropdowns.`}
          onClick={runBacksync}
          disabled={running || !from || !to}
        />
      </div>

      {/* Document picker */}
      {showPicker && (
        <div className="bg-panel border border-border rounded-card shadow-subtle p-4.5 mb-5">
          {!isForwardPair() ? (
            <p className="m-0 text-[12.5px] text-text-dim leading-relaxed">
              Document/language filtering only applies to <strong>Promote</strong> and{" "}
              <strong>Reconcile</strong> (from <strong>{from || "the lower"}</strong> up to{" "}
              <strong>{to || "the upper"}</strong> environment). Your current From/To is set up for{" "}
              <strong>Backsync</strong> instead, which always processes every synced document —
              there&apos;s nothing to pick here for that direction.
            </p>
          ) : (
            <>
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
            </>
          )}

          {isForwardPair() && !docsLoading && !docsError && documents.length > 0 && (
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
              {promoteResult.created} created, {promoteResult.updated} updated,{" "}
              {promoteResult.unchanged} already up to date.{" "}
              {promoteResult.hasPendingRelease ? (
                <>
                  Next: publish the Migration Release in <strong>{promoteResult.upperName}</strong>
                  &apos;s Prismic dashboard, then use <strong>Confirm</strong> above.
                  {!promoteResult.isFinalHop && (
                    <>
                      {" "}
                      Then continue promoting from <code>{promoteResult.upperName}</code>.
                    </>
                  )}
                </>
              ) : (
                <>Nothing changed on this run — there&apos;s no new Release to publish.</>
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

      {verifyResult && (
        <ResultCard tone={verifyResult.report.passed ? "success" : "warning"}>
          <strong className="font-display">
            {verifyResult.lowerName} → {verifyResult.upperName}{" "}
            {verifyResult.report.passed ? "— verify passed" : "— verify found issues"}
          </strong>
          <p className="mt-1.5">
            {verifyResult.report.countCheck.lowerCount} lower / {verifyResult.report.countCheck.upperCount}{" "}
            synced upper ({verifyResult.report.countCheck.matches ? "match" : "MISMATCH"}) ·{" "}
            {verifyResult.report.spotCheck.mismatches.length}/{verifyResult.report.spotCheck.sampleSize}{" "}
            spot-check mismatches
          </p>
          {verifyResult.report.spotCheck.mismatches.length > 0 && (
            <div className="text-warning mt-1.5">
              <p className="m-0">
                {verifyResult.report.spotCheck.mismatches.length} document(s) have content that
                doesn&apos;t match between the two sides:
              </p>
              <ul className="m-0 mt-1 pl-4 list-none">
                {verifyResult.report.spotCheck.mismatches.map((id) => (
                  <li key={id} className="mt-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px]">{id}</code>
                      <button
                        onClick={() => toggleInspect(id)}
                        className={`${btnSecondary} !px-2 !py-0.5 !text-[11px]`}
                      >
                        {inspectOpenId === id ? "Hide" : "Inspect"}
                      </button>
                    </div>
                    {inspectOpenId === id && (
                      <InspectPanel loading={inspectLoading} error={inspectError} result={inspectResult} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(verifyResult.report.brokenLinkScan.affectedDocuments).length > 0 && (
            <div className="text-warning mt-1.5">
              <p className="m-0">
                {Object.keys(verifyResult.report.brokenLinkScan.affectedDocuments).length} document(s)
                have broken document links (upper id → unresolved lower id(s) it still points at):
              </p>
              <ul className="m-0 mt-1 pl-4">
                {Object.entries(verifyResult.report.brokenLinkScan.affectedDocuments).map(
                  ([upperId, targets]) => (
                    <li key={upperId}>
                      <code className="text-[11px]">{upperId}</code> → {targets.map((t) => (
                        <code key={t} className="text-[11px]">
                          {t}
                        </code>
                      ))}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          {Object.keys(verifyResult.report.assetCheck.affectedDocuments).length > 0 && (
            <div className="text-warning mt-1.5">
              <p className="m-0">
                {Object.keys(verifyResult.report.assetCheck.affectedDocuments).length} document(s) have
                broken asset references:
              </p>
              <ul className="m-0 mt-1 pl-4">
                {Object.entries(verifyResult.report.assetCheck.affectedDocuments).map(
                  ([upperId, targets]) => (
                    <li key={upperId}>
                      <code className="text-[11px]">{upperId}</code> → {targets.map((t) => (
                        <code key={t} className="text-[11px]">
                          {t}
                        </code>
                      ))}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          {verifyResult.report.deletedDocuments.length > 0 && (
            <p className="text-warning mt-1.5">
              {verifyResult.report.deletedDocuments.length} synced document(s) were deleted on one
              side outside this tool.
            </p>
          )}
          {verifyResult.report.deletedAssets.length > 0 && (
            <p className="text-warning mt-1.5">
              {verifyResult.report.deletedAssets.length} migrated asset(s) were deleted on the upper
              side outside this tool.
            </p>
          )}
        </ResultCard>
      )}

      {reconcileResult && (
        <ResultCard tone={reconcileResult.ambiguous.length + reconcileResult.failed.length > 0 ? "warning" : "success"}>
          <strong className="font-display">
            {reconcileResult.lowerName} → {reconcileResult.upperName}{" "}
            {reconcileResult.dryRun ? "— reconcile dry run complete" : "— reconcile complete"}
          </strong>
          <p className="mt-1.5">{reconcileResult.reconciled} document(s) linked.</p>
          {reconcileResult.notFound.length > 0 && (
            <p className="text-warning mt-1.5">
              {reconcileResult.notFound.length} document(s) not found via the content API — the
              pre-existing upper document is likely an unpublished draft. Find its id in the
              dashboard and use <code>link --from={from} --to={to} &lt;lowerId&gt; &lt;upperId&gt;</code>.
            </p>
          )}
          {reconcileResult.ambiguous.length > 0 && (
            <p className="text-warning mt-1.5">
              {reconcileResult.ambiguous.length} document(s) matched more than one upper document —
              needs a human to pick the right one.
            </p>
          )}
          {reconcileResult.failed.length > 0 && (
            <p className="text-danger mt-1.5">
              {reconcileResult.failed.length} lookup(s) failed — see the log above for detail.
            </p>
          )}
        </ResultCard>
      )}
    </div>
  );
}

function InspectPanel({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: string | null;
  result: InspectResult | null;
}) {
  if (loading) {
    return <p className="text-text-dim text-[12px] mt-1.5 mb-0">Fetching both sides…</p>;
  }
  if (error) {
    return <p className="text-danger text-[12px] mt-1.5 mb-0">Couldn&apos;t load: {error}</p>;
  }
  if (!result) return null;

  if (!result.upperDoc) {
    return (
      <p className="text-danger text-[12px] mt-1.5 mb-0">
        <code className="text-[11px]">{result.upperId}</code> doesn&apos;t exist in{" "}
        {result.upperName} — still unpublished, or deleted outside this tool.
      </p>
    );
  }

  return (
    <div className="mt-2 bg-panel-2 border border-border rounded-control p-3 text-[12px]">
      {result.differingKeys.length > 0 ? (
        <p className="m-0 mb-2 text-warning">
          Differing field(s): {result.differingKeys.map((k) => (
            <code key={k} className="text-[11px] mr-1">
              {k}
            </code>
          ))}
        </p>
      ) : (
        <p className="m-0 mb-2 text-text-dim">
          No top-level field differs after rewrite+normalize — likely a Prismic-side denormalization
          (a Content Relationship or Image field&apos;s live snapshot, e.g. slug or dimensions) rather
          than an actual migration bug.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="m-0 font-semibold text-text-dim uppercase text-[10px] tracking-wide">
              {result.lowerName} — {result.lowerId}
            </p>
            <CopyButton text={JSON.stringify(result.lowerDoc.data, null, 2)} />
          </div>
          <pre className="m-0 max-h-[260px] overflow-auto bg-panel border border-border rounded-control p-2 text-[11px] whitespace-pre-wrap break-words">
            {JSON.stringify(result.lowerDoc.data, null, 2)}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="m-0 font-semibold text-text-dim uppercase text-[10px] tracking-wide">
              {result.upperName} — {result.upperId}
            </p>
            <CopyButton text={JSON.stringify(result.upperDoc.data, null, 2)} />
          </div>
          <pre className="m-0 max-h-[260px] overflow-auto bg-panel border border-border rounded-control p-2 text-[11px] whitespace-pre-wrap break-words">
            {JSON.stringify(result.upperDoc.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. no permission, non-HTTPS
      // context) — nothing useful to recover into, so just leave the
      // button unchanged rather than pretending it worked.
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`${btnSecondary} !px-2 !py-0.5 !text-[10.5px] shrink-0`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ActionButton({
  eyebrow,
  label,
  caption,
  onClick,
  disabled,
  disabledReason,
  variant = "secondary",
}: {
  eyebrow: string;
  label: string;
  caption: string;
  onClick: () => void;
  disabled: boolean;
  /** Shown as the button's tooltip only while `disabled` is true — lets a disabled state explain itself instead of just going inert. */
  disabledReason?: string;
  variant?: "secondary" | "primary";
}) {
  return (
    <div className="flex flex-col gap-1.5 items-start basis-[170px] flex-1 min-w-[150px] max-w-[230px]">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-text-dim">{eyebrow}</span>
      <button
        onClick={onClick}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={`${variant === "primary" ? btnPrimary : btnSecondary} w-full`}
      >
        {label}
      </button>
      <span className="text-[10.5px] text-text-dim leading-snug">{caption}</span>
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
