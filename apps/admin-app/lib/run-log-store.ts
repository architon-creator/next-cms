import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// Persists every promote/confirm run's log lines to disk as they stream,
// so a run survives closing the browser tab — nothing else in admin-app
// wrote these anywhere before. One JSON-lines file per run, in the exact
// `{ ts, level, event, ...fields }` shape prismic-migration's own log()
// produces, so public/log-viewer.html (a straight copy of
// packages/prismic-migration/tools/log-viewer.html) can open a saved run
// exactly the same way it opens a captured CLI run.
const RUN_LOG_DIR = join(process.cwd(), "run-logs");

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export type RunLogWriter = {
  filename: string;
  appendLine: (line: string) => Promise<void>;
};

/** Call once at the start of a run; pass every log() line to appendLine as it arrives. */
export async function createRunLog(
  action: "promote" | "confirm" | "backsync" | "rollback" | "verify" | "reconcile",
  from: string,
  to: string,
): Promise<RunLogWriter> {
  await mkdir(RUN_LOG_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  // "__" between fields, not "-" — the timestamp itself is full of
  // hyphens (2026-09-14T15-00-58-316Z once colons/dots are escaped for a
  // filename), so a single-hyphen-delimited scheme can't be parsed back
  // apart unambiguously. "__" doesn't occur in any of these values.
  const filename = `${safeName(action)}__${safeName(from)}__${safeName(to)}__${safeName(timestamp)}.jsonl`;
  const filePath = join(RUN_LOG_DIR, filename);

  return {
    filename,
    async appendLine(line: string) {
      await appendFile(filePath, line + "\n", "utf8");
    },
  };
}

export type RunLogSummary = {
  filename: string;
  action: string;
  from: string;
  to: string;
  timestamp: string;
};

/** Newest first. Action/from/to come from the filename (see createRunLog); the timestamp comes from the file's own mtime, not re-parsed out of the (lossily-escaped) filename. */
export async function listRunLogs(): Promise<RunLogSummary[]> {
  let entries: string[];
  try {
    entries = await readdir(RUN_LOG_DIR);
  } catch {
    return [];
  }

  const summaries = await Promise.all(
    entries
      .filter((name) => name.endsWith(".jsonl"))
      .map(async (filename) => {
        const [action, from, to] = filename.replace(/\.jsonl$/, "").split("__");
        if (!action || !from || !to) return null;
        const stats = await stat(join(RUN_LOG_DIR, filename));
        return { filename, action, from, to, timestamp: stats.mtime.toISOString() };
      }),
  );

  return summaries
    .filter((s): s is RunLogSummary => s !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export type LastRunsByAction = Record<string, string>; // action -> ISO timestamp of its most recent run

/**
 * The most recent run timestamp per action, for one adjacent pair —
 * matched by lower/upper name regardless of which direction a given
 * action's from/to happened to run in (promote/confirm/verify/reconcile
 * use from=lower,to=upper; backsync uses the reverse), since this is
 * keyed by the PAIR, not by a specific from/to order.
 */
export async function lastRunsForPair(
  lowerName: string,
  upperName: string,
): Promise<LastRunsByAction> {
  const all = await listRunLogs(); // newest first
  const result: LastRunsByAction = {};
  for (const run of all) {
    const matchesPair =
      (run.from === lowerName && run.to === upperName) ||
      (run.from === upperName && run.to === lowerName);
    if (!matchesPair) continue;
    if (result[run.action]) continue; // already have the newest for this action
    result[run.action] = run.timestamp;
  }
  return result;
}

/**
 * The filename of the most recent "promote" run logged for this exact
 * from/to pair, or null if there's none. Used to refuse rolling back
 * anything but the latest run for a pair — rolling back an older one
 * after a newer run has since touched the same documents would silently
 * undo that newer run's real changes, since rollback has no way to tell
 * "this document changed again for a good reason" from "nobody's
 * touched it since."
 */
export async function latestPromoteRun(from: string, to: string): Promise<string | null> {
  const all = await listRunLogs(); // newest first
  const match = all.find((r) => r.action === "promote" && r.from === from && r.to === to);
  return match?.filename ?? null;
}

export type RollbackTarget = { upperId: string; docType: string; lowerId?: string };

export type RollbackPlanFromLog = {
  /** null if this run's log never recorded a phase0.snapshots_taken event — a dry run's phase0 still takes real snapshots, so this being null means the log is from something else entirely, or is truncated/corrupt. */
  upperSnapshotPath: string | null;
  updated: RollbackTarget[];
  created: RollbackTarget[];
};

/**
 * Reads a saved run's log and pulls out exactly what prismic-migration's
 * own runRollback() needs: the pre-hop snapshot path, and which
 * documents that hop actually created vs updated for real. A dry run
 * never emits phase2.created/phase2.updated (only phase2.would_create),
 * so this naturally comes back empty for one — safe, not an error.
 */
export async function buildRollbackPlanFromLog(filename: string): Promise<RollbackPlanFromLog> {
  const text = await readRunLog(filename);
  let upperSnapshotPath: string | null = null;
  const updated: RollbackTarget[] = [];
  const created: RollbackTarget[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // a non-JSON line (shouldn't happen in a file we wrote ourselves, but don't crash on it)
    }

    if (entry.event === "phase0.snapshots_taken" && typeof entry.upperSnapshot === "string") {
      upperSnapshotPath = entry.upperSnapshot;
    } else if (entry.event === "phase2.updated") {
      updated.push({
        upperId: String(entry.upperId),
        docType: String(entry.docType),
        lowerId: typeof entry.lowerId === "string" ? entry.lowerId : undefined,
      });
    } else if (entry.event === "phase2.created") {
      created.push({
        upperId: String(entry.upperId),
        docType: String(entry.docType),
        lowerId: typeof entry.lowerId === "string" ? entry.lowerId : undefined,
      });
    }
  }

  return { upperSnapshotPath, updated, created };
}

/**
 * Whether a completed "verify"/"reconcile"/"backsync" run found nothing
 * worth a human's attention — used only to let the History page's
 * "Hide no-op runs" filter de-clutter repeated checks during active
 * testing; "promote"/"confirm"/"rollback" are never treated as no-op
 * here (promote's own no-op-ness is already known from
 * buildRollbackPlanFromLog's created/updated counts, and confirm/
 * rollback are always meaningful regardless of what they find).
 * Defaults to false (never hidden) if the run's terminal event is
 * missing or unparseable — hiding a run this can't positively confirm
 * was a no-op would risk hiding one that wasn't.
 */
export async function isNoOpCheckRun(
  action: string,
  filename: string,
): Promise<boolean> {
  if (action !== "verify" && action !== "reconcile" && action !== "backsync") return false;

  const text = await readRunLog(filename);
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (action === "verify" && entry.event === "phase3.done") {
      return entry.passed === true;
    }
    if (action === "reconcile" && entry.event === "reconcile.done") {
      return (
        entry.reconciled === 0 &&
        entry.ambiguous === 0 &&
        entry.notFound === 0 &&
        entry.failed === 0
      );
    }
    if (action === "backsync" && entry.event === "phase4.done") {
      return (
        entry.synced === 0 &&
        Number(entry.conflictCount ?? 0) === 0 &&
        Number(entry.deletedOnOneSideCount ?? 0) === 0
      );
    }
  }
  return false;
}

export async function readRunLog(filename: string): Promise<string> {
  // Reject anything that isn't a bare filename we generated ourselves —
  // this is served back over HTTP, so path traversal (`../../etc`) must
  // not be able to escape RUN_LOG_DIR. `.` is allowed (the timestamp
  // segment has one, e.g. "...T15_02_21.410Z.jsonl") — safe here since
  // neither `/` nor `\` is in this charset, so there's no path to
  // traverse even with `..`.
  if (!/^[a-zA-Z0-9_.-]+\.jsonl$/.test(filename)) {
    throw new Error("Invalid run log filename");
  }
  return readFile(join(RUN_LOG_DIR, filename), "utf8");
}
