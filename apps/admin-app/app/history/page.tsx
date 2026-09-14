import Link from "next/link";
import { listRunLogs } from "@/lib/run-log-store";
import RollbackButton from "./RollbackButton";

export const metadata = { title: "Run history · admin-app" };
export const dynamic = "force-dynamic"; // always show the latest runs, never cache this list

export default async function HistoryPage() {
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

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent)",
          margin: "0 0 4px",
        }}
      >
        admin-app
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Migration run history</h1>
      <p style={{ color: "var(--text-dim)", margin: "0 0 24px", fontSize: 13 }}>
        Every promote/confirm run triggered from{" "}
        <Link href="/migrations">the migrations page</Link> is saved here as it streams —
        survives closing the tab. Click a run to open it in the full log viewer
        (report, chart, export).
      </p>

      {runs.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No runs yet.</p>
      ) : (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10 }}>
          {runs.map((run) => (
            <div
              key={run.filename}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <a
                href={`/log-viewer.html?load=${encodeURIComponent(
                  `/api/migrations/history/${run.filename}`,
                )}&label=${encodeURIComponent(`${run.from} → ${run.to} (${run.action})`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", color: "var(--text)", flex: 1 }}
              >
                <span>
                  <strong>
                    {run.from} → {run.to}
                  </strong>{" "}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginLeft: 6,
                    }}
                  >
                    {run.action}
                  </span>
                </span>
                <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                  {new Date(run.timestamp).toLocaleString()}
                </div>
              </a>
              {run.action === "promote" && (
                <RollbackButton
                  filename={run.filename}
                  from={run.from}
                  to={run.to}
                  isLatest={latestPromoteFilenames.has(run.filename)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
