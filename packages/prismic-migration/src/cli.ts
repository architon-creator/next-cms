#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./config.js";
import { resolvePair, requireDirection } from "./lib/environments.js";
import { log } from "./lib/logger.js";
import { getDocumentById, getMasterRef, PrismicApiError } from "./lib/prismic-http.js";
import { runPhase0 } from "./phases/phase0-preflight.js";
import { runPhase1 } from "./phases/phase1-assets.js";
import { runPhase2 } from "./phases/phase2-migrate.js";
import { runConfirm } from "./phases/phase2-confirm.js";
import { runLink, runUnlink } from "./phases/phase-link.js";
import { runReconcile } from "./phases/phase-reconcile.js";
import { runRetitle } from "./phases/phase-retitle.js";
import { runPhase3 } from "./phases/phase3-verify.js";
import { runPhase4 } from "./phases/phase4-backsync.js";

// Loads .env from the current working directory — the whole reason a
// `DEV_REPOSITORY=...` in .env is enough, with no need to export it into
// the shell first. Must run before loadConfig() reads process.env below.
//
// Calls dotenv's own config() explicitly rather than `import "dotenv/config"`:
// that side-effecting subpath's exact resolution has been observed to differ
// across dotenv major versions (a real install hit
// `ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'` on that import, with
// Node suggesting `dotenv/config.js` instead) — likely a newer dotenv
// resolved by that project's own workspace than the ^16.x this package
// declares. The root export's `config()` function has been stable across
// dotenv's versions for years, so this is resolution-independent.
loadDotenv();

const COMMANDS = [
  "preflight",
  "assets",
  "migrate",
  "reconcile",
  "link",
  "unlink",
  "inspect",
  "retitle",
  "confirm",
  "verify",
  "backsync",
] as const;
type Command = (typeof COMMANDS)[number];

/** Every pairwise command takes --from=<env> --to=<env>, resolved against the configured environment chain (see lib/environments.ts). Both are mandatory — there is no dev/sit default once the chain can be more than two environments. */
function getFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function usage(): never {
  console.error(
    [
      "Usage: prismic-migration <command> --from=<env> --to=<env> [--dry-run]",
      "",
      "--from/--to name two environments from your configured ENVIRONMENT_CHAIN",
      "(default dev,sit,uat,prod) and must be adjacent in that chain. Which one",
      "is 'lower' and which is 'upper' is derived from chain order, not from",
      "--from/--to order — e.g. both `--from=dev --to=sit` and `--from=sit",
      "--to=dev` resolve to the same dev/sit mapping file, but forward-only",
      "commands (preflight/assets/migrate/reconcile/retitle/confirm) require",
      "--from to be the lower one, and backsync requires --from to be the",
      "upper one.",
      "",
      "Commands:",
      "  preflight   Phase 0 — schema parity check/push, snapshots, mapping init",
      "  assets      Phase 1 — migrate the lower environment's asset library up",
      "  migrate     Phase 2 — two-pass document migration, lower -> upper",
      "  reconcile   Link lower documents to a pre-existing upper document of",
      "              the same non-repeatable type, so migrate stops trying",
      "              to create a duplicate. Run this after migrate reports",
      "              'non-repeatable, already exists' failures.",
      "  link <lowerId> <upperId>",
      "              Manually link a lower document to an upper document that",
      "              `reconcile` couldn't find on its own — the pre-existing",
      "              upper document is an unpublished draft, invisible to the",
      "              content API. Find its id in the dashboard's URL.",
      "  unlink <lowerId>",
      "              Undo a `link`/`reconcile` — forgets the mapping entry",
      "              (does not touch the upper environment). Typical flow:",
      "              delete the document in the upper environment's dashboard,",
      "              unlink it here, then `migrate` again to create a fresh",
      "              copy from the lower environment.",
      "  inspect <lowerId> [upperId]",
      "              Pretty-prints the lower document's raw `data` JSON — for",
      "              checking the actual shape of an image/media/link field",
      "              against what lib/rewrite-refs.ts assumes (documented",
      "              as unverified in the README). Pass upperId too to print",
      "              the upper environment's live version alongside it, for",
      "              diffing a phase3 spot-check mismatch by eye.",
      "  retitle     One-time fix for documents created with the raw lower-",
      "              environment id as their title (no uid at create time).",
      "              Only touches the upper document when the lower document",
      "              is unchanged since the original migration.",
      "  confirm     After a human publishes the Migration Release in the",
      "              upper environment, mark the now-live documents 'synced'",
      "  verify      Phase 3 — read-only checks; exits non-zero on any failure",
      "  backsync    Phase 4 — ongoing upper -> lower sync; exits non-zero on any conflict",
      "",
      "--dry-run logs the planned diff without writing anything (preflight/assets/migrate/reconcile/link/unlink/retitle/backsync).",
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

  const fromName = getFlag(rest, "from");
  const toName = getFlag(rest, "to");
  if (!fromName || !toName) {
    console.error("Both --from=<env> and --to=<env> are required.");
    usage();
  }
  const pair = resolvePair(config, fromName, toName);
  const positional = rest.filter((arg) => !arg.startsWith("--"));

  switch (command as Command) {
    case "preflight":
      requireDirection(pair, "forward", "preflight");
      await runPhase0({ config, pair, dryRun });
      return;
    case "assets":
      requireDirection(pair, "forward", "assets");
      await runPhase1({ config, pair, dryRun });
      return;
    case "migrate": {
      requireDirection(pair, "forward", "migrate");
      const result = await runPhase2({ config, pair, dryRun });
      if (result.failures.length > 0) {
        // Every document this run COULD process still got processed —
        // runPhase2 never aborts the batch on one failure. This is what
        // decides "halt" for the overall command: exit non-zero so CI
        // catches it, without pretending the run silently succeeded.
        log("error", "cli.migrate_had_failures", { failures: result.failures });
        process.exitCode = 1;
      }
      return;
    }
    case "reconcile": {
      requireDirection(pair, "forward", "reconcile");
      const result = await runReconcile({ config, pair, dryRun });
      if (result.ambiguous.length > 0) {
        log("warn", "cli.reconcile_ambiguous", { ambiguous: result.ambiguous });
      }
      if (result.notFound.length > 0) {
        // These are non-repeatable types where the upper environment's
        // existing document is an unpublished draft — invisible to the
        // content API, so nothing automated can find it. `link` is the
        // manual escape hatch.
        log("warn", "cli.reconcile_not_found", {
          notFound: result.notFound,
          hint: `find each document's id in the ${pair.upperName} dashboard, then: pnpm cli link --from=${pair.lowerName} --to=${pair.upperName} <lowerId> <upperId>`,
        });
      }
      if (result.failed.length > 0) {
        // A lookup itself errored (network, an API 4xx) — distinct from
        // notFound (a clean answer of "zero matches"). Re-running
        // reconcile is safe and cheap: it only re-processes documents
        // still unmapped, so a transient failure here just needs a retry.
        log("error", "cli.reconcile_failed", { failed: result.failed });
        process.exitCode = 1;
      }
      return;
    }
    case "link": {
      const [lowerId, upperId] = positional;
      if (!lowerId || !upperId) {
        console.error(
          "Usage: prismic-migration link --from=<env> --to=<env> <lowerId> <upperId>",
        );
        process.exitCode = 1;
        return;
      }
      const linked = await runLink({ config, pair, lowerId, upperId, dryRun });
      if (!linked) process.exitCode = 1;
      return;
    }
    case "unlink": {
      const [lowerId] = positional;
      if (!lowerId) {
        console.error(
          "Usage: prismic-migration unlink --from=<env> --to=<env> <lowerId>",
        );
        process.exitCode = 1;
        return;
      }
      const unlinked = await runUnlink({ config, pair, lowerId, dryRun });
      if (!unlinked) process.exitCode = 1;
      return;
    }
    case "inspect": {
      // Optional 2nd id: pass an upperId to also print the upper
      // environment's live version alongside the lower one, for diffing
      // a phase3 spot-check mismatch by eye (e.g. is Prismic itself
      // enriching a field on save/read, rather than this toolkit's
      // rewrite actually being wrong).
      const [lowerId, upperId] = positional;
      if (!lowerId) {
        console.error(
          "Usage: prismic-migration inspect --from=<env> --to=<env> <lowerId> [upperId]",
        );
        process.exitCode = 1;
        return;
      }
      const lowerRef = await getMasterRef(pair.lower);
      const doc = await getDocumentById(pair.lower, lowerRef, lowerId);
      if (!doc) {
        log("error", "cli.inspect_not_found", { lowerId });
        process.exitCode = 1;
        return;
      }
      // Deliberately plain console.log, not the structured logger — this
      // is for a human to read/paste, not another JSON log line.
      console.log(`=== ${pair.lowerName} ===`);
      console.log(JSON.stringify(doc, null, 2));

      if (upperId) {
        const upperRef = await getMasterRef(pair.upper);
        const upperDoc = await getDocumentById(pair.upper, upperRef, upperId);
        console.log(`\n=== ${pair.upperName} ===`);
        console.log(
          upperDoc
            ? JSON.stringify(upperDoc, null, 2)
            : "(not found — still unpublished, or wrong id)",
        );
      }
      return;
    }
    case "retitle":
      requireDirection(pair, "forward", "retitle");
      await runRetitle({ config, pair, dryRun });
      return;
    case "confirm":
      requireDirection(pair, "forward", "confirm");
      await runConfirm({ config, pair });
      return;
    case "verify": {
      const report = await runPhase3({ config, pair });
      if (!report.passed) {
        log("error", "cli.verify_failed", { report });
        process.exitCode = 1;
      }
      return;
    }
    case "backsync": {
      requireDirection(pair, "backward", "backsync");
      const result = await runPhase4({ config, pair, dryRun });
      if (result.conflicts.length > 0) {
        process.exitCode = 1; // halt, don't force-push (Phase 5 rule)
      }
      return;
    }
  }
}

main().catch((err) => {
  // A PrismicApiError's `body` is the whole reason this is worth a special
  // case: Prismic's own 4xx responses are JSON error descriptions (which
  // field was rejected, and why) — without logging it, a 400 tells you
  // nothing but "something was wrong with the request".
  log("error", "cli.fatal", {
    message: err instanceof Error ? err.message : String(err),
    ...(err instanceof PrismicApiError ? { status: err.status, body: err.body } : {}),
  });
  // `process.exitCode = 1` (not `process.exit(1)`) deliberately: a failure
  // here can arrive while a sibling request from the same Promise.all is
  // still in flight (e.g. Phase 0's parallel custom-type fetches) — forcing
  // the process down immediately can abort that request's socket mid-flight
  // and crash the runtime itself (reproduced as a libuv assertion on
  // Windows). Setting exitCode lets Node exit with the right code once the
  // event loop actually drains, instead of yanking it out from under
  // in-flight I/O. The trade-off: a request that hangs forever (no
  // fetch/AbortController timeout exists anywhere in this codebase yet)
  // would hang the process instead of crashing it — add a timeout to
  // lib/prismic-http.ts's `request()` if that becomes a real problem.
  process.exitCode = 1;
});
