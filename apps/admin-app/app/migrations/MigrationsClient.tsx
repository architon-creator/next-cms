"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

type EnvironmentsResponse = { chain: string[]; configured: string[] };

const levelColor: Record<LogEntry["level"], string> = {
  info: "var(--accent)",
  warn: "var(--warning)",
  error: "var(--danger)",
};

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

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
      setErrorMsg(data ? JSON.parse(data).message : "Connection to the server was lost.");
      setRunning(false);
      es.close();
    });
  }

  function runPromote() {
    if (!from || !to) return;
    if (!dryRun) {
      const ok = window.confirm(
        `This will write real content into "${to}". This is NOT a dry run.\n\nContinue?`,
      );
      if (!ok) return;
    }
    const url = `/api/migrations/promote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&dryRun=${dryRun}`;
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
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Prismic migrations</h1>
      <p style={{ color: "var(--text-dim)", margin: "0 0 24px", fontSize: 13 }}>
        Runs the same preflight + assets + migrate hop as{" "}
        <code>pnpm cli promote --from=... --to=...</code>, live, without a
        terminal. <Link href="/history">Past runs →</Link>
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: 16,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Field label="From">
          <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={running}>
            {chain.map((env) => (
              <option key={env} value={env} disabled={!configured.includes(env)}>
                {env}
                {!configured.includes(env) ? " (not configured)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To">
          <select value={to} onChange={(e) => setTo(e.target.value)} disabled={running}>
            {chain.map((env) => (
              <option key={env} value={env} disabled={!configured.includes(env)}>
                {env}
                {!configured.includes(env) ? " (not configured)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            marginBottom: 2,
          }}
        >
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={running}
          />
          Dry run (log the plan, write nothing)
        </label>
        <div style={{ flex: 1 }} />
        <button
          onClick={runConfirm}
          disabled={running || !from || !to}
          style={btnStyle("secondary")}
        >
          Confirm (after publish)
        </button>
        <button onClick={runPromote} disabled={running || !from || !to} style={btnStyle("primary")}>
          {running ? "Running…" : dryRun ? "Run dry run" : "Run promote hop"}
        </button>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "var(--danger-weak)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      {(lines.length > 0 || running) && (
        <div
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
            maxHeight: 320,
            overflowY: "auto",
            fontFamily: "var(--mono)",
            fontSize: 12,
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
              <span style={{ color: "var(--text-dim)", flex: "none" }}>
                {new Date(line.ts).toLocaleTimeString()}
              </span>
              <span style={{ color: levelColor[line.level], fontWeight: 700, flex: "none" }}>
                {line.level.toUpperCase()}
              </span>
              <span style={{ fontWeight: 600, flex: "none" }}>{line.event}</span>
              <span style={{ color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {Object.entries(line)
                  .filter(([k]) => !["ts", "level", "event"].includes(k))
                  .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                  .join("  ")}
              </span>
            </div>
          ))}
          {running && <div style={{ color: "var(--text-dim)" }}>Running…</div>}
          <div ref={logEndRef} />
        </div>
      )}

      {promoteResult && (
        <ResultCard>
          <strong>
            {promoteResult.lowerName} → {promoteResult.upperName}{" "}
            {promoteResult.ok
              ? promoteResult.dryRun
                ? "— dry run complete"
                : "— hop complete"
              : "— had failures"}
          </strong>
          {promoteResult.failures.length > 0 && (
            <p style={{ color: "var(--danger)" }}>
              {promoteResult.failures.length} failure(s) — see the log above for detail.
            </p>
          )}
          {promoteResult.ok && !promoteResult.dryRun && (
            <p style={{ marginTop: 8 }}>
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
          <strong>
            {confirmResult.lowerName} → {confirmResult.upperName} confirmed synced.
          </strong>
        </ResultCard>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5 }}>
      <span style={{ color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--success-weak)",
        border: "1px solid var(--success)",
        borderRadius: 10,
        padding: "14px 16px",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function btnStyle(kind: "primary" | "secondary"): React.CSSProperties {
  return {
    border: kind === "primary" ? "1px solid var(--accent)" : "1px solid var(--border)",
    background: kind === "primary" ? "var(--accent)" : "var(--panel-2)",
    color: kind === "primary" ? "#fff" : "var(--text)",
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  };
}
