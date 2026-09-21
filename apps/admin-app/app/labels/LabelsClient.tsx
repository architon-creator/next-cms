"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NamespaceStatus = "new" | "changed" | "up-to-date";
type Namespace = {
  namespace: string;
  fieldCount: number;
  status: NamespaceStatus;
  addedKeys: string[];
  removedKeys: string[];
};

/**
 * Whether a namespace's document already exists in Prismic — from
 * /api/labels/prismic-status, a live Prismic lookup (see
 * check-labels-prismic-status-demo.ts). Deliberately separate from
 * NamespaceStatus above: that one only diffs en.json against the local
 * customtypes/ model file, which answers "does Step 1 have anything left
 * to generate", not "has Step 2 ever actually run for this namespace" —
 * a namespace can be schema up-to-date and still have no document in
 * Prismic at all.
 */
type PrismicNamespaceStatus = "no-model" | "new" | "existing" | "error";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-control px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap " +
  "transition-colors enabled:active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer";
const btnSecondary = `${btnBase} border border-border bg-panel-2 text-text enabled:hover:border-accent enabled:hover:text-accent`;
const btnPrimary = `${btnBase} border border-accent bg-accent text-white enabled:hover:brightness-110`;

function diffTooltip(ns: Namespace): string {
  if (ns.status === "up-to-date") {
    return `${ns.fieldCount} field(s) — already matches customtypes/, nothing to generate`;
  }
  if (ns.status === "new") {
    return `${ns.fieldCount} field(s) — no customtypes/ file exists yet for this namespace`;
  }
  const parts: string[] = [];
  if (ns.addedKeys.length > 0) parts.push(`new key(s): ${ns.addedKeys.join(", ")}`);
  if (ns.removedKeys.length > 0) parts.push(`removed key(s): ${ns.removedKeys.join(", ")}`);
  return `${ns.fieldCount} field(s) — ${parts.join("; ")}`;
}

/**
 * One namespace multi-select, reused independently by Step 1 (Generate)
 * and Step 2 (Seed) — each keeps its own selection now (they used to
 * share one, which meant narrowing a Seed run to a couple of namespaces
 * also narrowed the next Generate run, and vice versa, with no way to
 * tell the two apart from either card alone).
 */
function NamespacePicker({
  label,
  variant,
  namespaces,
  actionable,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabled,
  prismicStatuses,
  prismicStatusesLoaded,
}: {
  label: string;
  /**
   * "seed" disables a namespace's chip entirely in two cases, neither of
   * which the checkbox can safely act on:
   *  - no local customtypes/ model yet (schema "new") — seeding before
   *    the type is even pushed to Prismic just fails with a 404-ish
   *    "type not found" error.
   *  - a document already exists in Prismic (prismicStatus "existing")
   *    — re-seeding overwrites its entire content from en.json, and this
   *    card's own description already tells people to edit an existing
   *    document directly in Prismic instead. Nothing here can distinguish
   *    "deliberate re-seed" from "forgot this was already done," so the
   *    UI doesn't offer it at all; do it via the CLI script directly
   *    (`pnpm run prismic-seed-content -- --write --namespaces=X`) if you
   *    really mean to overwrite one.
   * Only prismicStatus "new" (schema pushed, no document yet) is
   * actionable — that's also all Select All ever bulk-selects.
   *
   * Unlike "generate", "seed" does NOT grey out schema "up-to-date"
   * namespaces on their own — that status is about whether en.json
   * matches the local model file, not about whether this namespace has
   * ever been seeded into Prismic. Whether to grey a namespace out here
   * comes from `prismicStatuses` instead (see PrismicNamespaceStatus).
   */
  variant: "generate" | "seed";
  namespaces: Namespace[];
  actionable: Namespace[];
  selected: Set<string>;
  onToggle: (namespace: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  disabled: boolean;
  /** "seed" variant only: live Prismic existence per namespace, keyed by namespace name. */
  prismicStatuses?: Record<string, PrismicNamespaceStatus>;
  /** "seed" variant only: whether the /api/labels/prismic-status fetch has resolved yet. */
  prismicStatusesLoaded?: boolean;
}) {
  const existingInPrismicCount =
    variant === "seed" && prismicStatuses
      ? namespaces.filter((ns) => prismicStatuses[ns.namespace] === "existing").length
      : 0;

  // Seed's "Select all" only ever bulk-selects not-yet-seeded namespaces
  // (see onSelectAll at the call site) — re-seeding an existing document
  // is opt-in only, one at a time. If every actionable namespace already
  // has a document in Prismic (or the lookup hasn't resolved yet), that
  // button would be a no-op if clicked, so disable it instead of leaving
  // it clickable with nothing for it to do.
  const selectAllDisabled =
    disabled ||
    (variant === "seed"
      ? !prismicStatusesLoaded ||
        namespaces.filter(
          (ns) => ns.status !== "new" && prismicStatuses?.[ns.namespace] === "new",
        ).length === 0
      : actionable.length === 0);

  return (
    <div className="bg-panel-2 border border-border rounded-card p-3 mt-2">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-dim m-0">
          {label} — {selected.size}/{actionable.length} selected
          {variant === "generate" &&
            namespaces.length > actionable.length &&
            ` · ${namespaces.length - actionable.length} already up to date`}
          {variant === "seed" && !prismicStatusesLoaded && " · checking Prismic…"}
          {variant === "seed" &&
            prismicStatusesLoaded &&
            existingInPrismicCount > 0 &&
            ` · ${existingInPrismicCount} already in Prismic`}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={onSelectAll}
            disabled={selectAllDisabled}
            className={`${btnSecondary} !px-2.5 !py-1 !text-[11px]`}
          >
            Select all
          </button>
          <button
            onClick={onSelectNone}
            disabled={disabled || selected.size === 0}
            className={`${btnSecondary} !px-2.5 !py-1 !text-[11px]`}
          >
            Select none
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {namespaces.map((ns) => {
          const isUnpushedForSeed = variant === "seed" && ns.status === "new";
          const prismicStatus = prismicStatuses?.[ns.namespace];
          const isExistingInPrismic = variant === "seed" && prismicStatus === "existing";
          const isUpToDate =
            variant === "generate"
              ? ns.status === "up-to-date"
              : variant === "seed"
                ? // "existing" is disabled too, not just opt-in-checkable: the
                  // card text above already tells people to edit an existing
                  // document directly in Prismic instead. Leaving its
                  // checkbox live invited exactly the accidental-overwrite
                  // re-seed this tool's docs warn against.
                  isUnpushedForSeed || isExistingInPrismic || !prismicStatusesLoaded
                : false;
          const isWarned = isUnpushedForSeed || isExistingInPrismic || prismicStatus === "error";
          const isChecked = !isUpToDate && selected.has(ns.namespace);

          let title: string;
          if (isUnpushedForSeed) {
            title = `${ns.fieldCount} field(s) — no customtypes/ file yet, so this almost certainly isn't live in Prismic either. Generate + push its schema first, or seeding will fail.`;
          } else if (variant === "seed" && !prismicStatusesLoaded) {
            title = `${ns.fieldCount} field(s) — checking whether this document already exists in Prismic…`;
          } else if (variant === "seed" && prismicStatus === "existing") {
            title = `${ns.fieldCount} field(s) — a document already exists in Prismic. Seeding will overwrite its entire content with en.json's current values.`;
          } else if (variant === "seed" && prismicStatus === "error") {
            title = `${ns.fieldCount} field(s) — couldn't determine whether this document exists in Prismic yet (checked at page load).`;
          } else if (variant === "seed" && prismicStatus === "new") {
            title = `${ns.fieldCount} field(s) — no document in Prismic yet; seeding will create it.`;
          } else {
            title = diffTooltip(ns);
          }

          return (
            <label
              key={ns.namespace}
              title={title}
              className={
                "flex items-center gap-1.5 text-[11.5px] font-medium border rounded-full px-2.5 py-1 transition-colors select-none " +
                (isUpToDate
                  ? "bg-panel border-border text-text-dim opacity-60 cursor-default"
                  : isWarned
                    ? isChecked
                      ? "bg-warning-weak border-warning text-warning cursor-pointer"
                      : "bg-panel border-warning text-warning cursor-pointer"
                    : isChecked
                      ? "bg-accent-weak border-accent text-accent cursor-pointer"
                      : "bg-panel border-border text-text hover:border-accent cursor-pointer")
              }
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(ns.namespace)}
                disabled={disabled || isUpToDate}
                className="size-3 accent-accent cursor-pointer disabled:cursor-default"
              />
              {ns.namespace}{" "}
              <span className={isChecked ? "opacity-80" : isWarned ? "" : "text-text-dim"}>
                · {ns.fieldCount}
                {variant === "generate" && ns.status === "new" && " · new file"}
                {variant === "generate" &&
                  ns.status === "changed" &&
                  ` · ${[
                    ns.addedKeys.length > 0 ? `+${ns.addedKeys.length} key` : null,
                    ns.removedKeys.length > 0 ? `-${ns.removedKeys.length} key` : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}`}
                {variant === "seed" && isUnpushedForSeed && " · needs push first"}
                {variant === "seed" &&
                  !isUnpushedForSeed &&
                  !prismicStatusesLoaded &&
                  " · checking…"}
                {variant === "seed" &&
                  !isUnpushedForSeed &&
                  prismicStatusesLoaded &&
                  prismicStatus === "new" &&
                  " · not seeded yet"}
                {variant === "seed" &&
                  !isUnpushedForSeed &&
                  prismicStatusesLoaded &&
                  prismicStatus === "existing" &&
                  " · already in Prismic"}
                {variant === "seed" &&
                  !isUnpushedForSeed &&
                  prismicStatusesLoaded &&
                  prismicStatus === "error" &&
                  " · status unknown"}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function LogPanel({ lines, running }: { lines: string[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  if (lines.length === 0 && !running) return null;
  return (
    <div className="bg-panel-2 border border-border rounded-card p-3 mt-3 max-h-[320px] overflow-auto font-mono text-[12px] whitespace-pre-wrap">
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith("[stderr]") ? "text-danger" : "text-text"}>
          {line}
        </div>
      ))}
      {running && <div className="text-text-dim">Running…</div>}
      <div ref={endRef} />
    </div>
  );
}

function useSseRunner() {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<Record<string, unknown> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function start(url: string) {
    setLines([]);
    setErrorMsg(null);
    setDoneData(null);
    setRunning(true);

    const es = new EventSource(url);
    esRef.current = es;
    es.addEventListener("log", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { line: string };
      setLines((prev) => [...prev, data.line]);
    });
    es.addEventListener("done", (e) => {
      setDoneData(JSON.parse((e as MessageEvent).data));
      setRunning(false);
      es.close();
    });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      setErrorMsg(data ? JSON.parse(data).message ?? String(data) : "Connection to the server was lost.");
      setRunning(false);
      es.close();
    });
  }

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  return { running, lines, errorMsg, doneData, start };
}

/** Every namespace whose field set has actually changed since it was last generated — the only ones a selection can usefully act on. */
function actionableOf(namespaces: Namespace[]): Namespace[] {
  return namespaces.filter((ns) => ns.status !== "up-to-date");
}

/**
 * Every namespace that actually has a local customtypes/ model, i.e. Seed
 * has somewhere to write to — unlike `actionableOf` above, this does NOT
 * exclude schema "up-to-date" namespaces: whether Step 1 thinks a
 * namespace's schema is current says nothing about whether Step 2 has
 * ever run for it (see PrismicNamespaceStatus).
 */
function seedActionableOf(namespaces: Namespace[]): Namespace[] {
  return namespaces.filter((ns) => ns.status !== "new");
}

/**
 * Only omit the `namespaces` filter when EVERY namespace in en.json is
 * selected — not just every actionable one. Comparing against the
 * actionable count instead was a real bug: with any up-to-date (disabled,
 * never-selected) namespace present, selecting every actionable one could
 * never be told apart from "everything", so the filter silently dropped
 * and the underlying script ran against ALL namespaces instead of just
 * the ones checked (confirmed live). Sending the explicit list even when
 * it happens to equal `actionable` is always correct; omitting it is only
 * ever safe when `selected` truly covers every namespace found.
 */
function namespacesParamOf(selected: Set<string>, namespaces: Namespace[]): string | null {
  return selected.size > 0 && selected.size < namespaces.length
    ? Array.from(selected).join(",")
    : null;
}

export default function LabelsClient() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [namespacesError, setNamespacesError] = useState<string | null>(null);
  const [writeMode, setWriteMode] = useState(false);
  const [generateSelected, setGenerateSelected] = useState<Set<string>>(new Set());
  const [seedSelected, setSeedSelected] = useState<Set<string>>(new Set());
  const [prismicStatuses, setPrismicStatuses] = useState<Record<string, PrismicNamespaceStatus>>(
    {},
  );
  const [prismicStatusesLoaded, setPrismicStatusesLoaded] = useState(false);
  const [prismicStatusError, setPrismicStatusError] = useState<string | null>(null);
  const seedDefaultAppliedRef = useRef(false);

  const generate = useSseRunner();
  const seed = useSseRunner();

  useEffect(() => {
    fetch("/api/labels/namespaces")
      .then((r) => r.json())
      .then((data: { namespaces: Namespace[] }) => {
        setNamespaces(data.namespaces);
        // Generate defaults to every namespace that actually has
        // something to do — "up-to-date" ones are disabled entirely, so
        // there's nothing useful a default selection could do with them.
        setGenerateSelected(
          new Set(
            data.namespaces.filter((ns) => ns.status !== "up-to-date").map((ns) => ns.namespace),
          ),
        );
        // Seed's default selection is set once the Prismic status fetch
        // below also resolves (see that effect) — it needs to know which
        // namespaces already have a document in Prismic, not just which
        // ones have a local model.
      })
      .catch((err) => setNamespacesError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    fetch("/api/labels/prismic-status")
      .then((r) => {
        if (!r.ok) return r.text().then((text) => Promise.reject(new Error(text)));
        return r.json();
      })
      .then((data: { statuses: Record<string, PrismicNamespaceStatus> }) => {
        setPrismicStatuses(data.statuses);
        setPrismicStatusesLoaded(true);
      })
      .catch((err) => {
        setPrismicStatusError(err instanceof Error ? err.message : String(err));
        setPrismicStatusesLoaded(true);
      });
  }, []);

  // Seed's default: only namespaces with a local model (seedActionable)
  // AND no document in Prismic yet — the same "safe to bulk-run" bar
  // Select All uses (see onSelectAll below). Runs once, as soon as both
  // the namespace list and the Prismic lookup have resolved; later
  // re-renders (e.g. a user toggling a checkbox) must not stomp on that.
  useEffect(() => {
    if (seedDefaultAppliedRef.current) return;
    if (namespaces.length === 0 || !prismicStatusesLoaded) return;
    seedDefaultAppliedRef.current = true;
    setSeedSelected(
      new Set(
        namespaces
          .filter((ns) => ns.status !== "new" && prismicStatuses[ns.namespace] === "new")
          .map((ns) => ns.namespace),
      ),
    );
  }, [namespaces, prismicStatuses, prismicStatusesLoaded]);

  const actionable = actionableOf(namespaces);
  const seedActionable = seedActionableOf(namespaces);

  function toggleIn(setSelected: React.Dispatch<React.SetStateAction<Set<string>>>, namespace: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(namespace)) next.delete(namespace);
      else next.add(namespace);
      return next;
    });
  }

  const newCount = namespaces.filter((ns) => ns.status === "new").length;
  const changedCount = namespaces.filter((ns) => ns.status === "changed").length;
  const recommendation =
    actionable.length === 0
      ? "Everything already matches en.json — nothing to Generate or Seed right now."
      : `Generate the ${generateSelected.size} selected namespace(s) below${
          newCount > 0 && changedCount > 0
            ? ` (${newCount} brand-new type${newCount === 1 ? "" : "s"}, ${changedCount} with field changes)`
            : newCount > 0
              ? ` (${newCount} brand-new type${newCount === 1 ? "" : "s"})`
              : ` (${changedCount} with field changes)`
        }, then push the updated customtypes/ folder to Prismic yourself (Type Builder or ` +
        `\`npx prismic push\`), then run Seed to fill in the new field values.`;

  const generateNamespacesParam = namespacesParamOf(generateSelected, namespaces);
  const seedNamespacesParam = namespacesParamOf(seedSelected, namespaces);

  function runGenerate() {
    const url = generateNamespacesParam
      ? `/api/labels/generate?namespaces=${encodeURIComponent(generateNamespacesParam)}`
      : "/api/labels/generate";
    generate.start(url);
  }

  function runSeed() {
    const scope = seedNamespacesParam ? `${seedSelected.size} selected namespace(s)` : "every namespace";
    if (writeMode) {
      const ok = window.confirm(
        `This will create/update real documents in the "next-js-ssr" repository (${scope}, plus the app_labels hub). This is NOT a dry run.\n\n` +
          `Updating an EXISTING document overwrites its entire content with en.json's current values, not just changed fields — if someone has already edited that document directly in Prismic, this will revert it.\n\nContinue?`,
      );
      if (!ok) return;
    }
    let url = `/api/labels/seed?write=${writeMode}`;
    if (seedNamespacesParam) url += `&namespaces=${encodeURIComponent(seedNamespacesParam)}`;
    seed.start(url);
  }

  const anyRunning = generate.running || seed.running;
  const nothingSelectedForGenerate = namespaces.length > 0 && generateSelected.size === 0;
  const nothingSelectedForSeed = namespaces.length > 0 && seedSelected.size === 0;

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
          href="/migrations"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-dim no-underline transition-colors hover:text-accent"
        >
          Migrations <span aria-hidden="true">→</span>
        </Link>
      </div>

      <h1 className="font-display text-[24px] font-extrabold tracking-tight mb-1.5 text-balance">
        Prismic labels
      </h1>
      <p className="text-text-dim mb-5 text-[13px] leading-relaxed max-w-[620px]">
        Turns <code>apps/frontend/messages/en.json</code> into Prismic custom types and seeds one
        document per namespace in <strong>next-js-ssr</strong>. Runs the same{" "}
        <code>pnpm --filter cms run prismic-model-generate</code> /{" "}
        <code>prismic-seed-content</code> scripts, live, without a terminal.
      </p>

      {namespacesError && (
        <p className="text-danger text-[13px] mb-4">{namespacesError}</p>
      )}
      {!namespacesError && namespaces.length === 0 && (
        <p className="text-text-dim text-[13px] mb-4">Loading namespaces…</p>
      )}

      {/* Generate */}
      <div className="bg-panel border border-border rounded-card shadow-subtle p-4.5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-dim mb-1">
              Step 1 · Prismic Custom Type Generation
            </p>
            <p className="text-text-dim text-[12.5px] max-w-[500px]">
              Writes local custom type files under <code>packages/cms/customtypes/</code> — one
              per namespace, plus an <code>app_labels</code> hub type. Safe to re-run anytime;
              only touches local files, never Prismic itself.
            </p>
          </div>
          <button
            onClick={runGenerate}
            disabled={anyRunning || nothingSelectedForGenerate}
            title={nothingSelectedForGenerate ? "Select at least one namespace below" : undefined}
            className={btnPrimary}
          >
            {generate.running
              ? "Running…"
              : generateNamespacesParam
                ? `Generate ${generateSelected.size} selected`
                : "Generate all"}
          </button>
        </div>

        {namespaces.length > 0 && (
          <NamespacePicker
            label="Namespaces to generate"
            variant="generate"
            namespaces={namespaces}
            actionable={actionable}
            selected={generateSelected}
            onToggle={(ns) => toggleIn(setGenerateSelected, ns)}
            onSelectAll={() => setGenerateSelected(new Set(actionable.map((ns) => ns.namespace)))}
            onSelectNone={() => setGenerateSelected(new Set())}
            disabled={anyRunning}
          />
        )}

        {(actionable.length > 0 || namespaces.length > 0) && (
          <p className="text-[12.5px] text-text-dim mt-3 mb-0 leading-relaxed">
            <strong className="text-text">Recommendation:</strong> {recommendation}
          </p>
        )}

        <LogPanel lines={generate.lines} running={generate.running} />
        {generate.errorMsg && (
          <p className="text-danger text-[13px] mt-2">{generate.errorMsg}</p>
        )}
        {generate.doneData && (
          <div className="bg-success-weak border border-success rounded-card px-4 py-3 mt-3 text-[13px] leading-relaxed">
            <strong className="font-display">Models generated.</strong>
            <p className="mt-1.5">
              Local files are updated, but nothing is live in Prismic yet — this tool can&apos;t
              push schema changes itself (verified this session: the local Prismic CLI isn&apos;t
              authenticated here, and <code>prismic push</code> needs an interactive browser
              login). Push them yourself with <code>npx prismic push</code> after{" "}
              <code>npx prismic login</code>, or import via Prismic&apos;s Type Builder, same as
              before.
            </p>
          </div>
        )}
      </div>

      {/* Seed */}
      <div className="bg-panel border border-border rounded-card shadow-subtle p-4.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-dim mb-1">
              Step 2 · Prismic Content Migration (after pushing the models above)
            </p>
            <p className="text-text-dim text-[12.5px] max-w-[500px]">
              Creates/updates one singleton document per namespace with the real{" "}
              <code>en.json</code> strings, then links them all from the <code>app_labels</code>{" "}
              hub document. One-time per namespace, not an ongoing sync — once a document exists,
              edit it directly in Prismic; re-seeding overwrites the whole document from{" "}
              <code>en.json</code>, not just changed fields.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-[12.5px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={writeMode}
                onChange={(e) => setWriteMode(e.target.checked)}
                disabled={anyRunning}
                className="size-3.5 accent-accent cursor-pointer"
              />
              Write for real (unchecked = dry run)
            </label>
            <button
              onClick={runSeed}
              disabled={anyRunning || nothingSelectedForSeed}
              title={nothingSelectedForSeed ? "Select at least one namespace below" : undefined}
              className={btnPrimary}
            >
              {seed.running
                ? "Running…"
                : `${writeMode ? "Seed" : "Preview"} ${seedNamespacesParam ? `${seedSelected.size} selected` : "all"}${writeMode ? "" : " (dry run)"}`}
            </button>
          </div>
        </div>

        {namespaces.length > 0 && (
          <NamespacePicker
            label="Namespaces to seed"
            variant="seed"
            namespaces={namespaces}
            actionable={seedActionable}
            selected={seedSelected}
            onToggle={(ns) => toggleIn(setSeedSelected, ns)}
            onSelectAll={() =>
              setSeedSelected(
                new Set(
                  seedActionable
                    .filter((ns) => prismicStatuses[ns.namespace] === "new")
                    .map((ns) => ns.namespace),
                ),
              )
            }
            onSelectNone={() => setSeedSelected(new Set())}
            disabled={anyRunning}
            prismicStatuses={prismicStatuses}
            prismicStatusesLoaded={prismicStatusesLoaded}
          />
        )}
        {prismicStatusError && (
          <p className="text-danger text-[12.5px] mt-2">
            Couldn&apos;t check Prismic for existing documents: {prismicStatusError}. Namespaces
            below are shown as not-yet-checked; seeding will still report create-vs-update
            correctly once it actually runs.
          </p>
        )}

        <LogPanel lines={seed.lines} running={seed.running} />
        {seed.errorMsg && <p className="text-danger text-[13px] mt-2">{seed.errorMsg}</p>}
        {seed.doneData && seed.doneData.nothingToSeed === true && (
          <div className="bg-warning-weak border border-warning rounded-card px-4 py-3 mt-3 text-[13px] leading-relaxed">
            <strong className="font-display">Nothing was seeded.</strong>
            <p className="mt-1.5">
              Every selected namespace was skipped — none of them has a customtypes/ model yet
              (see the log above). Run Generate for them and push the result to Prismic first.
            </p>
          </div>
        )}
        {seed.doneData && seed.doneData.nothingToSeed !== true && (
          <div className="bg-success-weak border border-success rounded-card px-4 py-3 mt-3 text-[13px] leading-relaxed">
            <strong className="font-display">
              {seed.doneData.write ? "Content seeded." : "Dry run complete."}
            </strong>
            {!seed.doneData.write && (
              <p className="mt-1.5">
                Nothing was written — check &quot;Write for real&quot; above and run again to
                actually create/update these documents.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
