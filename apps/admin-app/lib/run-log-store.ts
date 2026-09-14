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
export async function createRunLog(action: "promote" | "confirm", from: string, to: string): Promise<RunLogWriter> {
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
