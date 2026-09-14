import type { Config } from "../config.js";
import { resolveNextHop, resolvePair, requireDirection } from "./environments.js";
import { log } from "./logger.js";
import { runPhase0 } from "../phases/phase0-preflight.js";
import { runPhase1 } from "../phases/phase1-assets.js";
import { runPhase2 } from "../phases/phase2-migrate.js";
import { runConfirm } from "../phases/phase2-confirm.js";

// Extracted out of cli.ts's `promote`/`confirm` command handlers so a
// non-CLI caller (an admin UI's API route, wanting to trigger the same
// action a person would otherwise run via the terminal) can call exactly
// the same implementation instead of a second copy that risks drifting
// from the CLI's. cli.ts now calls these too — see its `promote`/`confirm`
// cases.

export type PromoteHopResult = {
  ok: boolean;
  lowerName: string;
  upperName: string;
  /** True once `toName` itself was reached; false if there's another hop still to go after a human publishes this one's Migration Release. */
  isFinalHop: boolean;
  failures: unknown[];
  dryRun: boolean;
};

/**
 * One hop of preflight + assets + migrate toward `toName`, which may be
 * several hops away (e.g. dev to prod runs the dev->sit hop only) — same
 * "one hop, then a human must publish before the next" behavior as the
 * CLI's `promote` command.
 */
export async function runPromoteHop(
  config: Config,
  fromName: string,
  toName: string,
  dryRun: boolean,
): Promise<PromoteHopResult> {
  const { pair, isFinalHop } = resolveNextHop(config, fromName, toName);
  log("info", "cli.promote_hop_start", {
    from: pair.lowerName,
    to: pair.upperName,
    finalDestination: toName,
  });

  await runPhase0({ config, pair, dryRun });
  await runPhase1({ config, pair, dryRun });
  const result = await runPhase2({ config, pair, dryRun });

  if (result.failures.length > 0) {
    log("error", "cli.promote_hop_had_failures", { failures: result.failures });
    return {
      ok: false,
      lowerName: pair.lowerName,
      upperName: pair.upperName,
      isFinalHop,
      failures: result.failures,
      dryRun,
    };
  }

  log("info", dryRun ? "cli.promote_dry_run_done" : "cli.promote_hop_done", {
    from: pair.lowerName,
    to: pair.upperName,
  });
  return {
    ok: true,
    lowerName: pair.lowerName,
    upperName: pair.upperName,
    isFinalHop,
    failures: [],
    dryRun,
  };
}

export type ConfirmActionResult = { lowerName: string; upperName: string };

/**
 * After a human publishes the Migration Release in the upper
 * environment's Prismic dashboard, marks the now-live documents
 * "synced". This tool cannot publish that Release itself — Prismic
 * requires a human review/publish step there, by design.
 */
export async function runConfirmAction(
  config: Config,
  fromName: string,
  toName: string,
): Promise<ConfirmActionResult> {
  const pair = resolvePair(config, fromName, toName);
  requireDirection(pair, "forward", "confirm");
  await runConfirm({ config, pair });
  return { lowerName: pair.lowerName, upperName: pair.upperName };
}
