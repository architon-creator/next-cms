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
  action: "promote" | "confirm" | "rollback",
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
