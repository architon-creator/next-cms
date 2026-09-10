#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./config.js";
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

function usage(): never {
  console.error(
    [
      "Usage: prismic-migration <command> [--dry-run]",
      "",
      "Commands:",
      "  preflight   Phase 0 — schema parity check/push, snapshots, mapping init",
      "  assets      Phase 1 — migrate the dev asset library to sit",
      "  migrate     Phase 2 — two-pass document migration, dev -> sit",
      "  reconcile   Link dev documents to a pre-existing sit document of",
      "              the same non-repeatable type, so migrate stops trying",
      "              to create a duplicate. Run this after migrate reports",
      "              'non-repeatable, already exists' failures.",
      "  link <devId> <sitId>",
      "              Manually link a dev document to a sit document that",
      "              `reconcile` couldn't find on its own — the pre-existing",
      "              sit document is an unpublished draft, invisible to the",
      "              content API. Find its id in the dashboard's URL.",
      "  unlink <devId>",
      "              Undo a `link`/`reconcile` — forgets the mapping entry",
      "              (does not touch sit). Typical flow: delete the document",
      "              in sit's dashboard, unlink it here, then `migrate` again",
      "              to create a fresh copy from dev.",
      "  inspect <devId> [sitId]",
      "              Pretty-prints a dev document's raw `data` JSON — for",
      "              checking the actual shape of an image/media/link field",
      "              against what lib/rewrite-refs.ts assumes (documented",
      "              as unverified in the README). Pass sitId too to print",
      "              sit's live version alongside it, for diffing a",
      "              phase3 spot-check mismatch by eye.",
      "  retitle     One-time fix for documents created with the raw dev id",
      "              as their title (no uid at create time). Only touches",
      "              sit when dev is unchanged since the original migration.",
      "  confirm     After a human publishes the Migration Release in sit,",
      "              mark the now-live documents 'synced'",
      "  verify      Phase 3 — read-only checks; exits non-zero on any failure",
      "  backsync    Phase 4 — ongoing sit -> dev sync; exits non-zero on any conflict",
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

  switch (command as Command) {
    case "preflight":
      await runPhase0({ config, dryRun });
      return;
    case "assets":
      await runPhase1({ config, dryRun });
      return;
    case "migrate": {
      const result = await runPhase2({ config, dryRun });
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
      const result = await runReconcile({ config, dryRun });
      if (result.ambiguous.length > 0) {
        log("warn", "cli.reconcile_ambiguous", { ambiguous: result.ambiguous });
      }
      if (result.notFound.length > 0) {
        // These are non-repeatable types where sit's existing document is
        // an unpublished draft — invisible to the content API, so nothing
        // automated can find it. `link` is the manual escape hatch.
        log("warn", "cli.reconcile_not_found", {
          notFound: result.notFound,
          hint: "find each document's id in the sit dashboard, then: pnpm cli link <devId> <sitId>",
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
      const [devId, sitId] = rest.filter((arg) => !arg.startsWith("--"));
      if (!devId || !sitId) {
        console.error("Usage: prismic-migration link <devId> <sitId>");
        process.exitCode = 1;
        return;
      }
      const linked = await runLink({ config, devId, sitId, dryRun });
      if (!linked) process.exitCode = 1;
      return;
    }
    case "unlink": {
      const [devId] = rest.filter((arg) => !arg.startsWith("--"));
      if (!devId) {
        console.error("Usage: prismic-migration unlink <devId>");
        process.exitCode = 1;
        return;
      }
      const unlinked = await runUnlink({ config, devId, dryRun });
      if (!unlinked) process.exitCode = 1;
      return;
    }
    case "inspect": {
      // Optional 2nd id: pass a sitId to also print sit's live version
      // alongside dev's, for diffing a phase3 spot-check mismatch by eye
      // (e.g. is Prismic itself enriching a field on save/read, rather
      // than this toolkit's rewrite actually being wrong).
      const [devId, sitId] = rest.filter((arg) => !arg.startsWith("--"));
      if (!devId) {
        console.error("Usage: prismic-migration inspect <devId> [sitId]");
        process.exitCode = 1;
        return;
      }
      const devRef = await getMasterRef(config.dev);
      const doc = await getDocumentById(config.dev, devRef, devId);
      if (!doc) {
        log("error", "cli.inspect_not_found", { devId });
        process.exitCode = 1;
        return;
      }
      // Deliberately plain console.log, not the structured logger — this
      // is for a human to read/paste, not another JSON log line.
      console.log("=== dev ===");
      console.log(JSON.stringify(doc, null, 2));

      if (sitId) {
        const sitRef = await getMasterRef(config.sit);
        const sitDoc = await getDocumentById(config.sit, sitRef, sitId);
        console.log("\n=== sit ===");
        console.log(
          sitDoc
            ? JSON.stringify(sitDoc, null, 2)
            : "(not found — still unpublished, or wrong id)",
        );
      }
      return;
    }
    case "retitle":
      await runRetitle({ config, dryRun });
      return;
    case "confirm":
      await runConfirm({ config });
      return;
    case "verify": {
      const report = await runPhase3({ config });
      if (!report.passed) {
        log("error", "cli.verify_failed", { report });
        process.exitCode = 1;
      }
      return;
    }
    case "backsync": {
      const result = await runPhase4({ config, dryRun });
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
