import Link from "next/link";
import { loadConfig } from "prismic-migration/config";
import { listPairStatuses } from "prismic-migration/actions";
import { lastRunsForPair } from "@/lib/run-log-store";

export const dynamic = "force-dynamic"; // always reflect the real current mapping-store state

const actionLabel: Record<string, string> = {
  promote: "Promote",
  confirm: "Confirm",
  backsync: "Backsync",
  verify: "Verify",
  reconcile: "Reconcile",
  rollback: "Rollback",
};

export default async function HomePage() {
  const config = loadConfig();
  const pairStatuses = await listPairStatuses(config);
  const withLastRuns = await Promise.all(
    pairStatuses.map(async (pair) => ({
      ...pair,
      lastRuns: await lastRunsForPair(pair.lowerName, pair.upperName),
    })),
  );

  return (
    <div className="max-w-[900px] mx-auto px-5 pt-8 pb-16">
      <p className="text-[11px] font-bold tracking-wider uppercase text-accent mb-1">admin-app</p>
      <h1 className="font-display text-[22px] font-extrabold tracking-tight mb-1.5">
        Environment status
      </h1>
      <p className="text-text-dim mb-6 text-[13px] leading-relaxed">
        One card per adjacent hop in the configured chain.{" "}
        <Link href="/migrations" className="text-accent underline">
          Run a migration →
        </Link>{" "}
        <Link href="/history" className="text-accent underline">
          Past runs →
        </Link>
      </p>

      <div className="flex flex-col gap-4">
        {withLastRuns.map((pair) => (
          <div
            key={`${pair.lowerName}-${pair.upperName}`}
            className="bg-panel border border-border rounded-card shadow-subtle p-4.5"
          >
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <h2 className="font-display text-[16px] font-bold m-0">
                {pair.lowerName} → {pair.upperName}
              </h2>
              {!pair.configured && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-text-dim bg-panel-2">
                  Not configured
                </span>
              )}
            </div>

            {pair.configured && (
              <>
                <div className="flex gap-4 mt-3 text-[13px]">
                  <span>
                    <strong className="text-success">{pair.counts.synced}</strong> synced
                  </span>
                  <span>
                    <strong className="text-accent">{pair.counts.pending}</strong> pending
                  </span>
                  <span>
                    <strong className={pair.counts.conflict > 0 ? "text-danger" : "text-text-dim"}>
                      {pair.counts.conflict}
                    </strong>{" "}
                    conflict{pair.counts.conflict === 1 ? "" : "s"}
                  </span>
                  <span className="text-text-dim">{pair.counts.total} tracked total</span>
                </div>

                {Object.keys(pair.lastRuns).length > 0 && (
                  <div className="flex gap-x-4 gap-y-1 mt-3 text-[11.5px] text-text-dim flex-wrap">
                    {Object.entries(pair.lastRuns).map(([action, timestamp]) => (
                      <span key={action}>
                        {actionLabel[action] ?? action}: {new Date(timestamp).toLocaleString()}
                      </span>
                    ))}
                  </div>
                )}

                {pair.counts.conflict > 0 && (
                  <p className="mt-3 text-[12.5px] text-danger">
                    {pair.counts.conflict} document(s) need a human decision — see{" "}
                    <Link href="/migrations" className="underline">
                      reconcile
                    </Link>{" "}
                    or check the pair&apos;s mapping file by hand.
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
