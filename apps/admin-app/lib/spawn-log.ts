import { spawn } from "node:child_process";

/**
 * Validates a `?namespaces=A,B,C` query value before it's ever
 * interpolated into a spawned command string. This matters more than it
 * would for a normal argv array: spawnAndStream below runs with
 * `shell: true` (required so `pnpm` resolves on Windows), and Node
 * explicitly does NOT escape shell metacharacters in that mode — an
 * unvalidated value here is a real command-injection vector (e.g.
 * `?namespaces=x;rm -rf /` or backticks), not just a theoretical one.
 * en.json's own top-level keys are always identifier-like PascalCase
 * words (Header, ContactPage, ...), so this can afford to be strict:
 * letters/digits/underscore only, comma-separated, nothing else.
 * Returns null for an empty/absent value (meaning "no filter"); throws
 * for anything that doesn't match, which callers turn into a 400.
 */
export function parseNamespaceListParam(raw: string | null): string[] | null {
  if (!raw) return null;
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  for (const item of items) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(item)) {
      throw new Error(
        `Invalid namespace "${item}" — namespace names may only contain letters and digits.`,
      );
    }
  }
  return items;
}

/**
 * Runs a command, line-buffering its stdout/stderr and handing each
 * complete line to `onLine` as it arrives — for streaming a plain-text
 * script's output over SSE the same way the migration toolkit's own
 * structured log() lines are streamed, just without the JSON structure
 * (these cms scripts are console.log-based, not built on prismic-migration's
 * logger). `shell: true` so `pnpm` resolves correctly on Windows (pnpm.cmd),
 * matching how every `pnpm ...` invocation in this repo is actually run.
 */
export function spawnAndStream(
  command: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void,
): Promise<{ exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true });

    let stdoutBuf = "";
    let stderrBuf = "";

    function consume(buf: string, chunk: string, isStderr: boolean): string {
      const combined = buf + chunk;
      const lines = combined.split(/\r?\n/);
      const remainder = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) onLine(isStderr ? `[stderr] ${line}` : line);
      }
      return remainder;
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf = consume(stdoutBuf, chunk.toString("utf8"), false);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf = consume(stderrBuf, chunk.toString("utf8"), true);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (exitCode) => {
      if (stdoutBuf) onLine(stdoutBuf);
      if (stderrBuf) onLine(`[stderr] ${stderrBuf}`);
      resolve({ exitCode });
    });
  });
}

/**
 * Runs a command to completion and returns its full stdout/stderr, for a
 * script that prints one structured result (e.g. a single JSON line)
 * rather than an ongoing log a browser should watch live — unlike
 * spawnAndStream, there's no SSE response to push partial output through,
 * so callers just await the whole thing. Same `shell: true` reasoning as
 * spawnAndStream (pnpm.cmd resolution on Windows).
 */
export function spawnAndCapture(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}
