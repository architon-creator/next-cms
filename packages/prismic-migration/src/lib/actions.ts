import { readFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { canonicalHash } from "./canonical-hash.js";
import { resolveNextHop, resolvePair, requireDirection } from "./environments.js";
import { log } from "./logger.js";
import { mappingFilePath } from "./mapping-paths.js";
import { MappingStore } from "./mapping-store.js";
import {
  getMasterRef,
  iterateAllDocuments,
  listCustomTypes,
  updateMigrationDocument,
} from "./prismic-http.js";
import { runPhase0 } from "../phases/phase0-preflight.js";
import { runPhase1 } from "../phases/phase1-assets.js";
import { buildTitle, runPhase2 } from "../phases/phase2-migrate.js";
import { runConfirm } from "../phases/phase2-confirm.js";
import type { DocumentMapping } from "../types.js";

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
 *
 * `onlyLowerIds`, when given, narrows just the document-migration step
 * (phase2) to those specific lower-environment document ids — e.g.
 * trying one document's migration before committing to the whole
 * library. `onlyLang` narrows to one Prismic locale instead (ignored if
 * `onlyLowerIds` is also given — picking specific documents already
 * implies which locale they're in). Phase 0 (schema) and Phase 1 (the
 * whole asset library) still run in full either way — neither is
 * meaningfully scoped per-document or per-locale.
 */
export async function runPromoteHop(
  config: Config,
  fromName: string,
  toName: string,
  dryRun: boolean,
  onlyLowerIds?: string[],
  onlyLang?: string,
): Promise<PromoteHopResult> {
  const { pair, isFinalHop } = resolveNextHop(config, fromName, toName);
  log("info", "cli.promote_hop_start", {
    from: pair.lowerName,
    to: pair.upperName,
    finalDestination: toName,
  });

  await runPhase0({ config, pair, dryRun });
  await runPhase1({ config, pair, dryRun });
  const result = await runPhase2({ config, pair, dryRun, onlyLowerIds, onlyLang });

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

export type RollbackTarget = { upperId: string; docType: string; lowerId?: string };

export type RollbackInput = {
  config: Config;
  fromName: string;
  toName: string;
  /** The upper environment's snapshot file taken by phase0 immediately before the hop being rolled back — see phase0.snapshots_taken's `upperSnapshot` field in that run's own log. */
  upperSnapshotPath: string;
  /** From that same run's phase2.updated events — documents that existed before the hop and can be reverted via the Migration API's update endpoint. */
  updated: RollbackTarget[];
  /** From that same run's phase2.created events — Prismic's Migration API has no delete endpoint, so these cannot be undone here; returned back so the caller can tell a human exactly what to remove by hand. */
  created: RollbackTarget[];
};

export type RollbackResult = {
  reverted: { upperId: string; ok: boolean; error?: string }[];
  needsManualDeletion: RollbackTarget[];
};

/**
 * Reverts a hop's UPDATES by restoring each touched document's pre-hop
 * content from the snapshot phase0 took right before that hop ran.
 * Cannot undo the hop's CREATES the same way — Prismic's Migration API
 * (https://migration.prismic.io) has no delete endpoint, only
 * create/update — those are returned in `needsManualDeletion` instead,
 * for a human to remove in the repository's own dashboard.
 *
 * Only meaningful for a real (non-dry-run) hop that actually wrote
 * something — a dry run never emits phase2.created/phase2.updated (only
 * phase2.would_create), so `updated`/`created` built from a dry run's log
 * will always be empty here, and this is a safe no-op.
 */
export async function runRollback(input: RollbackInput): Promise<RollbackResult> {
  const pair = resolvePair(input.config, input.fromName, input.toName);
  requireDirection(pair, "forward", "rollback");

  log("info", "rollback.start", {
    from: pair.lowerName,
    to: pair.upperName,
    toRevert: input.updated.length,
    toDeleteManually: input.created.length,
  });

  let snapshot: { documents: Array<{ id: string; uid: string | null; type: string; data: Record<string, unknown>; tags: string[] }> };
  try {
    snapshot = JSON.parse(await readFile(input.upperSnapshotPath, "utf8"));
  } catch (err) {
    log("error", "rollback.snapshot_unreadable", {
      upperSnapshotPath: input.upperSnapshotPath,
      message: err instanceof Error ? err.message : String(err),
    });
    throw new Error(`Could not read pre-hop snapshot at ${input.upperSnapshotPath} — nothing was reverted.`);
  }
  const byId = new Map(snapshot.documents.map((doc) => [doc.id, doc]));

  const reverted: RollbackResult["reverted"] = [];
  for (const target of input.updated) {
    const original = byId.get(target.upperId);
    if (!original) {
      reverted.push({ upperId: target.upperId, ok: false, error: "Not present in the pre-hop snapshot." });
      log("error", "rollback.revert_failed", {
        upperId: target.upperId,
        docType: target.docType,
        reason: "not_in_snapshot",
      });
      continue;
    }
    try {
      await updateMigrationDocument(pair.upper, target.upperId, {
        uid: original.uid ?? undefined,
        data: original.data,
        tags: original.tags,
      });
      reverted.push({ upperId: target.upperId, ok: true });
      log("info", "rollback.reverted", { upperId: target.upperId, docType: original.type });
    } catch (err) {
      reverted.push({
        upperId: target.upperId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      log("error", "rollback.revert_failed", {
        upperId: target.upperId,
        docType: target.docType,
        reason: "api_error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (input.created.length > 0) {
    log("warn", "rollback.manual_deletion_required", {
      count: input.created.length,
      documents: input.created,
    });
  }

  log("info", "rollback.done", {
    reverted: reverted.filter((r) => r.ok).length,
    revertFailed: reverted.filter((r) => !r.ok).length,
    needsManualDeletion: input.created.length,
  });

  return { reverted, needsManualDeletion: input.created };
}

export type LowerDocumentSummary = {
  id: string;
  uid: string | null;
  type: string;
  lang: string;
  /** Same label buildTitle would give it a Migration Release entry — human-readable, not necessarily unique. */
  title: string;
  /**
   * What a real (non-dry-run) hop would do with this document RIGHT NOW,
   * derived the same way phase2's own Pass 1 decides — a canonicalHash
   * comparison against this pair's mapping store, computed here so the
   * picker can show it before a run, not just find out from the log
   * during/after one. "create": no mapping entry yet. "unchanged": entry
   * exists and its content hash still matches. "update": entry exists
   * but the lower document's content has since changed.
   */
  predictedAction: "create" | "update" | "unchanged";
};

/**
 * Lists the lower environment's documents (id, type, a display title,
 * and a predicted create/update/unchanged action) — for a UI to offer as
 * a picker when narrowing a promote hop to specific documents via
 * runPromoteHop's onlyLowerIds, rather than requiring the caller to
 * already know a raw document id.
 */
export async function listLowerDocuments(
  config: Config,
  fromName: string,
  toName: string,
): Promise<LowerDocumentSummary[]> {
  const pair = resolvePair(config, fromName, toName);
  requireDirection(pair, "forward", "list documents");

  const ref = await getMasterRef(pair.lower);
  const typeInfo = new Map(
    (await listCustomTypes(pair.lower)).map((t) => [t.id, { label: t.label, repeatable: t.repeatable }]),
  );
  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const mapping = await mappingStore.load();

  const documents: LowerDocumentSummary[] = [];
  for await (const doc of iterateAllDocuments(pair.lower, ref)) {
    const existing = mapping[doc.id];
    const predictedAction: LowerDocumentSummary["predictedAction"] = !existing
      ? "create"
      : existing.lower_hash === canonicalHash(doc.data)
        ? "unchanged"
        : "update";

    documents.push({
      id: doc.id,
      uid: doc.uid,
      type: doc.type,
      lang: doc.lang,
      title: buildTitle(doc, typeInfo),
      predictedAction,
    });
  }
  return documents;
}
