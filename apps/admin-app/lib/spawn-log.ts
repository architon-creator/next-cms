import { spawn } from "node:child_process";

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
