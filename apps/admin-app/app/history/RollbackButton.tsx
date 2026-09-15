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
    <div className="shrink-0">
      <button
        onClick={run}
        disabled={running || !isLatest}
        title={
          !isLatest
            ? `A newer run exists for ${from} → ${to} — only the most recent run can be rolled back.`
            : undefined
        }
        className={
          "border border-danger bg-danger-weak text-danger rounded-control px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors " +
          (running || !isLatest ? "cursor-default opacity-50" : "cursor-pointer enabled:active:translate-y-px")
        }
      >
        {running ? "Rolling back…" : "Rollback"}
      </button>

      {open && (
        <div className="mt-2 text-[12px] max-w-[320px]">
          {lines.length > 0 && (
            <div className="bg-panel-2 border border-border rounded-card p-2.5 max-h-[200px] overflow-y-auto font-mono text-[11.5px] mb-2">
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
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {result && (
            <div>
              <p>
                Reverted {result.reverted.filter((r) => r.ok).length} of {result.reverted.length} updated
                document(s).
                {result.reverted.some((r) => !r.ok) && (
                  <span className="text-danger">
                    {" "}
                    {result.reverted.filter((r) => !r.ok).length} failed to revert — see log above.
                  </span>
                )}
              </p>
              {result.needsManualDeletion.length > 0 && (
                <div className="bg-warning-weak border border-warning text-warning rounded-card px-3 py-2.5">
                  <strong>
                    {result.needsManualDeletion.length} document(s) this run created can't be undone via
                    Prismic's API — delete these by hand in {to}&apos;s dashboard:
                  </strong>
                  <ul className="m-0 mt-1.5 pl-4.5">
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
