"use client";

import { useState } from "react";
import { formatServerError } from "@/lib/format-server-error";

type LogEntry = { ts: string; level: string; event: string; [key: string]: unknown };
type RollbackResult = {
  reverted: { upperId: string; ok: boolean; error?: string }[];
  needsManualDeletion: { upperId: string; docType: string; lowerId?: string }[];
};

// Only meaningful for a "promote" run's row — rolling back a "confirm" or
// a "rollback" run itself isn't a thing this tool models. Kept as its own
// small client component (rather than making the whole History page
// client-rendered) so each row's rollback state stays isolated from the
// others, and the page itself can stay a plain server component.
export default function RollbackButton({
  filename,
  from,
  to,
  isLatest,
}: {
  filename: string;
  from: string;
  to: string;
  /** False when a newer promote run exists for this exact pair — the server enforces this too (see /api/migrations/rollback), so this is a UX nicety, not the only guard. */
  isLatest: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<RollbackResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function run() {
    const ok = window.confirm(
      `Roll back this run against "${to}"?\n\n` +
        `Documents it UPDATED will be reverted to their content from just before this hop ran.\n` +
        `Documents it CREATED cannot be deleted via Prismic's API — you'll get a list to remove by hand in the dashboard.\n\n` +
        `Continue?`,
    );
    if (!ok) return;

    setOpen(true);
    setRunning(true);
    setLines([]);
    setResult(null);
    setErrorMsg(null);

    const es = new EventSource(
      `/api/migrations/rollback?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&runLogFilename=${encodeURIComponent(filename)}`,
    );
    es.addEventListener("log", (e) => {
      setLines((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
    });
    es.addEventListener("done", (e) => {
      setResult(JSON.parse((e as MessageEvent).data));
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

  return (
    <div>
      <button
        onClick={run}
        disabled={running || !isLatest}
        title={
          !isLatest
            ? `A newer run exists for ${from} → ${to} — only the most recent run can be rolled back.`
            : undefined
        }
        style={{
          border: "1px solid var(--danger)",
          background: "var(--danger-weak)",
          color: "var(--danger)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11.5,
          fontWeight: 600,
          cursor: running || !isLatest ? "default" : "pointer",
          opacity: !isLatest ? 0.5 : 1,
        }}
      >
        {running ? "Rolling back…" : "Rollback"}
      </button>

      {open && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {lines.length > 0 && (
            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                maxHeight: 200,
                overflowY: "auto",
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                marginBottom: 8,
              }}
            >
              {lines.map((line, i) => (
                <div key={i}>
                  <strong>{line.event}</strong>{" "}
                  {Object.entries(line)
                    .filter(([k]) => !["ts", "level", "event"].includes(k))
                    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                    .join("  ")}
                </div>
              ))}
            </div>
          )}
          {errorMsg && <p style={{ color: "var(--danger)" }}>{errorMsg}</p>}
          {result && (
            <div>
              <p>
                Reverted {result.reverted.filter((r) => r.ok).length} of {result.reverted.length} updated
                document(s).
                {result.reverted.some((r) => !r.ok) && (
                  <span style={{ color: "var(--danger)" }}>
                    {" "}
                    {result.reverted.filter((r) => !r.ok).length} failed to revert — see log above.
                  </span>
                )}
              </p>
              {result.needsManualDeletion.length > 0 && (
                <div
                  style={{
                    background: "var(--warning-weak)",
                    border: "1px solid var(--warning)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "var(--warning)",
                  }}
                >
                  <strong>
                    {result.needsManualDeletion.length} document(s) this run created can't be undone via
                    Prismic's API — delete these by hand in {to}&apos;s dashboard:
                  </strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {result.needsManualDeletion.map((d) => (
                      <li key={d.upperId}>
                        <code>{d.upperId}</code> ({d.docType})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
