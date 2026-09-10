#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { log } from "./lib/logger.js";
import { runPhase0 } from "./phases/phase0-preflight.js";
import { runPhase1 } from "./phases/phase1-assets.js";
import { runPhase2 } from "./phases/phase2-migrate.js";
import { runConfirm } from "./phases/phase2-confirm.js";
import { runPhase3 } from "./phases/phase3-verify.js";
import { runPhase4 } from "./phases/phase4-backsync.js";

const COMMANDS = [
  "preflight",
  "assets",
  "migrate",
  "confirm",
  "verify",
  "backsync",
] as const;
type Command = (typeof COMMANDS)[number];

function usage(): never {
  console.error(
    [
      "Usage: prismic-migration <command> [--dry-run]",
      "",
      "Commands:",
      "  preflight   Phase 0 — schema parity check/push, snapshots, mapping init",
      "  assets      Phase 1 — migrate the dev asset library to sit",
      "  migrate     Phase 2 — two-pass document migration, dev -> sit",
      "  confirm     After a human publishes the Migration Release in sit,",
      "              mark the now-live documents 'synced'",
      "  verify      Phase 3 — read-only checks; exits non-zero on any failure",
      "  backsync    Phase 4 — ongoing sit -> dev sync; exits non-zero on any conflict",
      "",
      "--dry-run logs the planned diff without writing anything (preflight/assets/migrate/backsync).",
    ].join("\n"),
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes("--dry-run");

  if (!command || !COMMANDS.includes(command as Command)) {
    usage();
  }

  const config = loadConfig();

  switch (command as Command) {
    case "preflight":
      await runPhase0({ config, dryRun });
      return;
    case "assets":
      await runPhase1({ config, dryRun });
      return;
    case "migrate":
      await runPhase2({ config, dryRun });
      return;
    case "confirm":
      await runConfirm({ config });
      return;
    case "verify": {
      const report = await runPhase3({ config });
      if (!report.passed) {
        log("error", "cli.verify_failed", { report });
        process.exit(1);
      }
      return;
    }
    case "backsync": {
      const result = await runPhase4({ config, dryRun });
      if (result.conflicts.length > 0) {
        process.exit(1); // halt, don't force-push (Phase 5 rule)
      }
      return;
    }
  }
}

main().catch((err) => {
  log("error", "cli.fatal", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
