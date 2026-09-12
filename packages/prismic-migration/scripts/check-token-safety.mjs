#!/usr/bin/env node
// Mechanically enforces this codebase's own repeated rule: a
// migrationToken (write-scoped, permanent) or accessToken must never
// reach a log line. Scans every call to log(...) in src/ and fails if
// the token identifier appears inside that call's argument list —
// whether directly (`log("x", { token: repo.migrationToken })`) or via
// a variable that's obviously the token itself.
//
// Deliberately narrow and grep-adjacent rather than a full AST parse:
// this only needs to catch an accidental `migrationToken`/`accessToken`
// identifier landing inside a log(...) call's parentheses, not every
// conceivable way a secret could leak. It complements code review, not
// replaces it.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const DANGEROUS = ["migrationToken", "accessToken"];

/** Finds every `log(` call site and returns the full text of its argument list, including nested parens. */
function findLogCallArgs(source) {
  const calls = [];
  const callRegex = /\blog\s*\(/g;
  let match;
  while ((match = callRegex.exec(source))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") depth -= 1;
      i += 1;
    }
    const argsText = source.slice(start, i - 1);
    const line = source.slice(0, match.index).split("\n").length;
    calls.push({ line, argsText });
  }
  return calls;
}

function listTsFiles(dir) {
  const results = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (name.endsWith(".ts")) results.push(full);
    }
  }
  return results;
}

function main() {
  const files = listTsFiles(SRC_DIR);
  const findings = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const { line, argsText } of findLogCallArgs(source)) {
      for (const dangerous of DANGEROUS) {
        if (argsText.includes(dangerous)) {
          findings.push({ file: path.relative(process.cwd(), file), line, dangerous });
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error("Found a log(...) call whose arguments reference a token field:\n");
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line} — references \`${f.dangerous}\``);
    }
    console.error(
      "\nA migrationToken/accessToken must never reach a log line — see the doc comment on RepoConfig in src/config.ts.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checked ${files.length} source files — no log(...) call references a token field.`,
  );
}

main();
