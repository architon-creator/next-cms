import Link from "next/link";
import { buildRollbackPlanFromLog, isNoOpCheckRun, listRunLogs } from "@/lib/run-log-store";
import RollbackButton from "./RollbackButton";

export const metadata = { title: "Run history · admin-app" };
export const dynamic = "force-dynamic"; // always show the latest runs, never cache this list

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ hideNoOp?: string }>;
}) {
  const hideNoOp = (await searchParams).hideNoOp === "1";
  const runs = await listRunLogs(); // newest first

  // The first "promote" run seen per from/to pair, in newest-first
  // order, is the latest one for that pair — precomputed here instead
  // of calling latestPromoteRun() per row, and rollback still enforces
  // this itself server-side, so a stale disabled state here is never
  // the only thing stopping a superseded rollback.
  const seenPromotePairs = new Set<string>();
  const latestPromoteFilenames = new Set<string>();
  for (const run of runs) {
    if (run.action !== "promote") continue;
    const pairKey = `${run.from}|${run.to}`;
    if (!seenPromotePairs.has(pairKey)) {
      seenPromotePairs.add(pairKey);
      latestPromoteFilenames.add(run.filename);
    }
  }

  // A promote run that created/updated nothing (dry run, or every
  // document was already in sync) has nothing for rollback to revert —
  // offering the button there is pure noise, and confusing since
  // clicking it would "succeed" while doing literally nothing. Also
  // doubles as this run's entry in `noOp` below.
  const rollbackPlans = new Map<string, boolean>(); // filename -> has anything to revert
  await Promise.all(
    runs
      .filter((run) => run.action === "promote")
      .map(async (run) => {
        const plan = await buildRollbackPlanFromLog(run.filename);
        rollbackPlans.set(run.filename, plan.updated.length + plan.created.length > 0);
      }),
  );

  // Whether each run found/did nothing worth a human's attention —
  // repeated verify/reconcile/backsync/promote runs during active
  // testing otherwise flood this list with near-duplicates. Never
  // computed for confirm/rollback: those are always meaningful
  // regardless of outcome.
  const noOp = new Map<string, boolean>();
  for (const run of runs) {
    if (run.action === "promote") {
      noOp.set(run.filename, !rollbackPlans.get(run.filename));
    }
  }
  await Promise.all(
    runs
      .filter((run) => run.action === "verify" || run.action === "reconcile" || run.action === "backsync")
      .map(async (run) => {
        noOp.set(run.filename, await isNoOpCheckRun(run.action, run.filename));
      }),
  );

  const visibleRuns = hideNoOp ? runs.filter((run) => !noOp.get(run.filename)) : runs;
  const hiddenCount = runs.length - visibleRuns.length;

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
          <span aria-hidden="true">←</span> Migrations
        </Link>
      </div>

      <h1 className="font-display text-[24px] font-extrabold tracking-tight mb-1.5 text-balance">
        Migration run history
      </h1>
      <p className="text-text-dim mb-5 text-[13px] leading-relaxed max-w-[620px]">
        Every promote/confirm run triggered from the{" "}
        <Link href="/migrations" className="text-accent underline">
          migrations page
        </Link>{" "}
        is saved here as it streams — survives closing the tab. Click a run to open it in the
        full log viewer (report, chart, export).
      </p>

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Link
          href={hideNoOp ? "/history" : "/history?hideNoOp=1"}
          className={
            "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[12px] font-semibold no-underline transition-colors " +
            (hideNoOp
              ? "bg-accent-weak border-accent text-accent"
              : "bg-panel border-border text-text-dim hover:border-accent hover:text-accent")
          }
        >
          <span
            aria-hidden="true"
            className={
              "size-3 rounded-[3px] border " +
              (hideNoOp ? "bg-accent border-accent" : "border-text-dim")
            }
          />
          Hide no-op runs
        </Link>
        {hideNoOp && hiddenCount > 0 && (
          <span className="text-[12px] text-text-dim">
            {hiddenCount} run(s) hidden — verify/reconcile/backsync that found nothing, or promote
            hops that changed nothing.
          </span>
        )}
      </div>

      {visibleRuns.length === 0 ? (
        <p className="text-text-dim text-[13px]">
          {runs.length === 0 ? "No runs yet." : "No runs match this filter."}
        </p>
      ) : (
        <div className="bg-panel border border-border rounded-card shadow-subtle overflow-hidden">
          {visibleRuns.map((run) => (
            <div
              key={run.filename}
              className={
                "flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0 " +
                (noOp.get(run.filename) ? "opacity-60" : "")
              }
            >
              <a
                href={`/log-viewer.html?load=${encodeURIComponent(
                  `/api/migrations/history/${run.filename}`,
                )}&label=${encodeURIComponent(`${run.from} → ${run.to} (${run.action})`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 no-underline text-text"
              >
                <span>
                  <strong className="font-display">
                    {run.from} → {run.to}
                  </strong>{" "}
                  <span className="text-[11px] font-bold uppercase tracking-wide text-text-dim ml-1.5">
                    {run.action}
                  </span>
                  {noOp.get(run.filename) && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-text-dim border border-border rounded-full px-1.5 py-px">
                      no-op
                    </span>
                  )}
                </span>
                <div className="text-[12px] text-text-dim font-mono mt-0.5">
                  {new Date(run.timestamp).toLocaleString()}
                </div>
              </a>
              {run.action === "promote" &&
                (rollbackPlans.get(run.filename) ? (
                  <RollbackButton
                    filename={run.filename}
                    from={run.from}
                    to={run.to}
                    isLatest={latestPromoteFilenames.has(run.filename)}
                  />
                ) : (
                  <span
                    className="text-[11.5px] text-text-dim self-center shrink-0"
                    title="This run created and updated nothing — there's nothing to roll back."
                  >
                    Nothing to roll back
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
