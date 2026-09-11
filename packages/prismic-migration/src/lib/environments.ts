import type { Config, RepoConfig } from "../config.js";

export type Direction = "forward" | "backward";

export type ResolvedPair = {
  /** Exactly what was passed as --from/--to, for error messages and logs. */
  fromName: string;
  toName: string;
  from: RepoConfig;
  to: RepoConfig;
  /** Fixed per pair, independent of --from/--to order — see types.ts's header comment. */
  lowerName: string;
  upperName: string;
  lower: RepoConfig;
  upper: RepoConfig;
  /** "forward" when --from is the lower environment (a promotion); "backward" when reversed (a back-sync). */
  direction: Direction;
};

/**
 * Validates and resolves a --from/--to pair against the configured
 * environment chain. Both names must be configured, AND adjacent in the
 * chain — this toolkit deliberately supports only a strict one-hop-at-a-
 * time promotion chain (dev -> sit -> uat -> prod) for now, not an
 * arbitrary matrix. A direct skip-tier path (e.g. dev -> uat) is a
 * deliberately deferred, not-yet-built feature — see the README.
 */
export function resolvePair(
  config: Config,
  fromName: string,
  toName: string,
): ResolvedPair {
  if (fromName === toName) {
    throw new Error(
      `--from and --to must be different environments (both were "${fromName}").`,
    );
  }

  // Chain membership and adjacency are checked BEFORE whether either
  // environment is actually configured — "is this even a name I
  // recognize" is a more fundamental problem than "do you have
  // credentials for it", and should be the error surfaced first when
  // both are true (a typo'd, unconfigured name would otherwise always
  // report as "not configured", never as "not a real environment").
  const fromIndex = config.environmentChain.indexOf(fromName);
  const toIndex = config.environmentChain.indexOf(toName);
  if (fromIndex === -1) {
    throw new Error(
      `"${fromName}" is not part of the configured environment chain (${config.environmentChain.join(" -> ")}).`,
    );
  }
  if (toIndex === -1) {
    throw new Error(
      `"${toName}" is not part of the configured environment chain (${config.environmentChain.join(" -> ")}).`,
    );
  }
  if (Math.abs(fromIndex - toIndex) !== 1) {
    throw new Error(
      `"${fromName}" and "${toName}" are not adjacent in the configured chain ` +
        `(${config.environmentChain.join(" -> ")}) — only one hop at a time is supported ` +
        `right now. A skip-tier path (e.g. dev -> uat directly) is not yet implemented.`,
    );
  }

  const from = requireEnvironment(config, fromName);
  const to = requireEnvironment(config, toName);

  const direction: Direction = fromIndex < toIndex ? "forward" : "backward";
  const lowerName = direction === "forward" ? fromName : toName;
  const upperName = direction === "forward" ? toName : fromName;

  return {
    fromName,
    toName,
    from,
    to,
    lowerName,
    upperName,
    lower: config.environments[lowerName],
    upper: config.environments[upperName],
    direction,
  };
}

export type NextHop = {
  /** The single adjacent hop to run right now — always forward (lower -> upper). */
  pair: ResolvedPair;
  /** True when this hop's upper environment is the requested final --to, i.e. nothing more to do after it. */
  isFinalHop: boolean;
};

/**
 * Resolves the FIRST hop of a (possibly multi-hop) promotion from
 * `fromName` toward `toName` — e.g. dev -> prod resolves to dev -> sit,
 * with `isFinalHop: false` telling the caller there's more chain left
 * after this hop completes and its Migration Release is published.
 *
 * Deliberately only ever returns one hop, not the whole path: `migrate`
 * reads a lower environment's PUBLISHED content only (master ref), so a
 * later hop can't safely run until a human has published the Migration
 * Release this hop creates — see the `promote` command in cli.ts, which
 * calls this once per invocation and tells the caller what to do next
 * rather than looping through every hop unattended.
 */
export function resolveNextHop(
  config: Config,
  fromName: string,
  toName: string,
): NextHop {
  if (fromName === toName) {
    throw new Error(
      `--from and --to must be different environments (both were "${fromName}").`,
    );
  }

  const fromIndex = config.environmentChain.indexOf(fromName);
  const toIndex = config.environmentChain.indexOf(toName);
  if (fromIndex === -1) {
    throw new Error(
      `"${fromName}" is not part of the configured environment chain (${config.environmentChain.join(" -> ")}).`,
    );
  }
  if (toIndex === -1) {
    throw new Error(
      `"${toName}" is not part of the configured environment chain (${config.environmentChain.join(" -> ")}).`,
    );
  }
  if (fromIndex >= toIndex) {
    throw new Error(
      `promote only moves up the chain. --from="${fromName}" --to="${toName}" is not upward ` +
        `(${config.environmentChain.join(" -> ")}). Use backsync for moving content down instead.`,
    );
  }

  const hopUpperName = config.environmentChain[fromIndex + 1];
  const pair = resolvePair(config, fromName, hopUpperName);
  return { pair, isFinalHop: hopUpperName === toName };
}

function requireEnvironment(config: Config, name: string): RepoConfig {
  const repo = config.environments[name];
  if (!repo) {
    const prefix = name.toUpperCase();
    throw new Error(
      `Environment "${name}" is not configured — expected ${prefix}_REPOSITORY and ` +
        `${prefix}_MIGRATION_TOKEN env vars.`,
    );
  }
  return repo;
}

/**
 * Throws unless `pair`'s direction matches what the calling command
 * requires — `migrate`/`preflight`/`assets` only ever promote lower ->
 * upper; `backsync` only ever syncs upper -> lower. Rejecting the wrong
 * direction outright (rather than, say, silently reinterpreting --from/
 * --to) is what makes "I typed the arguments backwards" fail loudly
 * instead of quietly doing the opposite of what was intended.
 */
export function requireDirection(
  pair: ResolvedPair,
  expected: Direction,
  commandName: string,
): void {
  if (pair.direction === expected) return;

  const oppositeCommand = expected === "forward" ? "backsync" : "migrate";
  const verb =
    expected === "forward" ? "promotes lower -> upper" : "syncs upper -> lower";
  throw new Error(
    `${commandName} only ${verb}. --from=${pair.fromName} --to=${pair.toName} is ${pair.direction} ` +
      `(${pair.lowerName} is the lower environment here). Use ${oppositeCommand} for that direction instead.`,
  );
}
