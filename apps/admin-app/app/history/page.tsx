import Link from "next/link";
import { listRunLogs } from "@/lib/run-log-store";

export const metadata = { title: "Run history · admin-app" };
export const dynamic = "force-dynamic"; // always show the latest runs, never cache this list

export default async function HistoryPage() {
  const runs = await listRunLogs();

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
            <a
              key={run.filename}
              href={`/log-viewer.html?load=${encodeURIComponent(
                `/api/migrations/history/${run.filename}`,
              )}&label=${encodeURIComponent(`${run.from} → ${run.to} (${run.action})`)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
                color: "var(--text)",
              }}
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
              <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                {new Date(run.timestamp).toLocaleString()}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
