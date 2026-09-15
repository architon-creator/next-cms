import { readFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { canonicalHash } from "./canonical-hash.js";
import { resolveNextHop, resolvePair, requireDirection } from "./environments.js";
import { LockConflictError } from "./lock.js";
import { log } from "./logger.js";
import { assetMappingFilePath, mappingFilePath } from "./mapping-paths.js";
import { MappingStore } from "./mapping-store.js";
import {
  getDocumentById,
  getMasterRef,
  iterateAllDocuments,
  listCustomTypes,
  PrismicApiError,
  updateMigrationDocument,
} from "./prismic-http.js";
import { normalizeForComparison, rewriteRefs } from "./rewrite-refs.js";
import { runPhase0 } from "../phases/phase0-preflight.js";
import { runPhase1 } from "../phases/phase1-assets.js";
import { buildTitle, runPhase2 } from "../phases/phase2-migrate.js";
import { runConfirm } from "../phases/phase2-confirm.js";
import { runPhase4 } from "../phases/phase4-backsync.js";
import { runPhase3, type Phase3Report } from "../phases/phase3-verify.js";
import { runReconcile, type ReconcileResult } from "../phases/phase-reconcile.js";
import type { AssetMapping, DocumentMapping, PrismicDocument } from "../types.js";

// Re-exported so a non-CLI caller (admin-app's API routes) can
// `instanceof`-check the same error types the CLI's own top-level
// handler special-cases, instead of matching on message text.
export { LockConflictError, PrismicApiError };

// Extracted out of cli.ts's `promote`/`confirm`/`backsync` command
// handlers so a non-CLI caller (an admin UI's API route, wanting to
// trigger the same action a person would otherwise run via the
// terminal) can call exactly the same implementation instead of a
// second copy that risks drifting from the CLI's. cli.ts now calls
// these too — see its `promote`/`confirm`/`backsync` cases.

export type PromoteHopResult = {
  ok: boolean;
  lowerName: string;
  upperName: string;
  /** True once `toName` itself was reached; false if there's another hop still to go after a human publishes this one's Migration Release. */
  isFinalHop: boolean;
  failures: unknown[];
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  /**
   * True when this hop actually created/updated/link-fixed up at least one
   * document via the Migration API — which is the only thing that lands
   * in an upper-environment Migration Release needing a human publish.
   * False on a hop where every document was already unchanged (nothing
   * written, so there's nothing new to publish) — distinct from `dryRun`,
   * which never writes at all.
   */
  hasPendingRelease: boolean;
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

  const hasPendingRelease = !dryRun && (result.created > 0 || result.updated > 0 || result.linkFixups > 0);

  if (result.failures.length > 0) {
    log("error", "cli.promote_hop_had_failures", { failures: result.failures });
    return {
      ok: false,
      lowerName: pair.lowerName,
      upperName: pair.upperName,
      isFinalHop,
      failures: result.failures,
      dryRun,
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      hasPendingRelease,
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
    created: result.created,
    updated: result.updated,
    unchanged: result.unchanged,
    hasPendingRelease,
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

export type BacksyncActionResult = {
  lowerName: string;
  upperName: string;
  dryRun: boolean;
  synced: number;
  pending: number;
  conflicts: {
    lowerId: string;
    upperId: string;
    docType: string;
    lastSyncedAt: string;
  }[];
  deletedOnOneSide: {
    lowerId: string;
    upperId: string;
    docType: string;
    deletedSide: "lower" | "upper";
  }[];
  /** True when this run needs a human — matches the CLI's own "halt, don't force-push" rule (see cli.ts's backsync case): a conflict or a document deleted on only one side is never resolved automatically. */
  hadIssues: boolean;
};

/**
 * Ongoing back-sync, upper -> lower (--from must be the upper
 * environment — the opposite direction from promote/migrate). Only
 * `status: "synced"` mapping entries are candidates; a `pending` or
 * `conflict` entry is left for a human (or the next promote run) to
 * resolve, never silently reprocessed here.
 */
export async function runBacksyncAction(
  config: Config,
  fromName: string,
  toName: string,
  dryRun: boolean,
): Promise<BacksyncActionResult> {
  const pair = resolvePair(config, fromName, toName);
  requireDirection(pair, "backward", "backsync");
  const result = await runPhase4({ config, pair, dryRun });
  return {
    lowerName: pair.lowerName,
    upperName: pair.upperName,
    dryRun,
    synced: result.synced,
    pending: result.pending,
    conflicts: result.conflicts,
    deletedOnOneSide: result.deletedOnOneSide,
    hadIssues: result.conflicts.length > 0 || result.deletedOnOneSide.length > 0,
  };
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

export type VerifyActionResult = {
  lowerName: string;
  upperName: string;
  report: Phase3Report;
};

/**
 * Read-only end-to-end verification — nothing here writes to either
 * repository. Works in either direction (unlike promote/confirm/
 * reconcile, which are forward-only, and backsync, which is backward-
 * only) since it's just checking the pair's current state, not moving
 * anything.
 */
export async function runVerifyAction(
  config: Config,
  fromName: string,
  toName: string,
): Promise<VerifyActionResult> {
  const pair = resolvePair(config, fromName, toName);
  const report = await runPhase3({ config, pair });
  return { lowerName: pair.lowerName, upperName: pair.upperName, report };
}

export type ReconcileActionResult = ReconcileResult & {
  lowerName: string;
  upperName: string;
  dryRun: boolean;
};

/**
 * Links a lower document to a pre-existing upper document of the same
 * non-repeatable custom type, so `promote`/`migrate` stops trying to
 * create a duplicate — see phase-reconcile.ts's own doc comment for why
 * this is scoped to non-repeatable types only.
 */
export async function runReconcileAction(
  config: Config,
  fromName: string,
  toName: string,
  dryRun: boolean,
): Promise<ReconcileActionResult> {
  const pair = resolvePair(config, fromName, toName);
  requireDirection(pair, "forward", "reconcile");
  const result = await runReconcile({ config, pair, dryRun });
  return { ...result, lowerName: pair.lowerName, upperName: pair.upperName, dryRun };
}

export type InspectActionResult = {
  lowerName: string;
  upperName: string;
  lowerId: string;
  upperId: string;
  lowerDoc: PrismicDocument;
  upperDoc: PrismicDocument | null;
  /** Same comparison phase3's spot-check runs — canonical hash of rewrite(lower) vs. upper's actual data. Undefined if the upper document doesn't exist (deleted, or not yet published). */
  matches?: boolean;
  /** Top-level `data` keys where the two sides differ, for a UI to highlight instead of dumping two full JSON blobs at a person. */
  differingKeys: string[];
};

/**
 * Fetches both sides of one mapped document, live, for a person to
 * compare by eye — the same comparison logic phase3's spot-check uses
 * (rewrite(lower) vs. upper's actual data, both normalized), but for a
 * single document a human already suspects is wrong, with the full
 * documents returned instead of just a pass/fail. Mirrors the CLI's own
 * `inspect` command; unlike that command this always resolves `upperId`
 * from the mapping file rather than requiring it as an argument, since a
 * UI investigating a phase3 mismatch only ever has the lower id in hand.
 */
export async function runInspectAction(
  config: Config,
  fromName: string,
  toName: string,
  lowerId: string,
): Promise<InspectActionResult> {
  const pair = resolvePair(config, fromName, toName);

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const mapping = await mappingStore.load();
  const assetMapping = await assetMappingStore.load();
  const entry = mapping[lowerId];
  if (!entry) {
    throw new Error(
      `"${lowerId}" has no mapping entry for ${pair.lowerName} -> ${pair.upperName} — it hasn't been migrated yet.`,
    );
  }

  const documentIds = Object.fromEntries(
    Object.entries(mapping).map(([id, e]) => [id, e.upper_id]),
  );
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([id, e]) => [
      id,
      { id: e.upper_asset_id, url: e.upper_asset_url },
    ]),
  );

  const lowerRef = await getMasterRef(pair.lower);
  const lowerDoc = await getDocumentById(pair.lower, lowerRef, lowerId);
  if (!lowerDoc) {
    throw new Error(`"${lowerId}" no longer exists in ${pair.lowerName}.`);
  }
  const upperRef = await getMasterRef(pair.upper);
  const upperDoc = await getDocumentById(pair.upper, upperRef, entry.upper_id);

  let matches: boolean | undefined;
  let differingKeys: string[] = [];
  if (upperDoc) {
    const rewrittenLower = normalizeForComparison(
      rewriteRefs(lowerDoc.data, { assetIds, documentIds }),
    ) as Record<string, unknown>;
    const normalizedUpper = normalizeForComparison(upperDoc.data) as Record<string, unknown>;
    matches = canonicalHash(rewrittenLower) === canonicalHash(normalizedUpper);
    if (!matches) {
      const allKeys = new Set([...Object.keys(rewrittenLower), ...Object.keys(normalizedUpper)]);
      differingKeys = Array.from(allKeys).filter(
        (key) => JSON.stringify(rewrittenLower[key]) !== JSON.stringify(normalizedUpper[key]),
      );
    }
  }

  return {
    lowerName: pair.lowerName,
    upperName: pair.upperName,
    lowerId,
    upperId: entry.upper_id,
    lowerDoc,
    upperDoc,
    matches,
    differingKeys,
  };
}

export type PairStatus = {
  lowerName: string;
  upperName: string;
  configured: boolean;
  counts: { synced: number; pending: number; conflict: number; total: number };
};

/**
 * Summarizes one adjacent pair's mapping store by status — purely a
 * local file read, no Prismic API calls, so this is cheap enough to
 * call for every pair in the chain on every dashboard page load. An
 * unconfigured pair (missing env vars for either side) is reported as
 * such rather than thrown, since a dashboard needs to show every pair
 * in the chain, configured or not.
 */
export async function getPairStatus(
  config: Config,
  lowerName: string,
  upperName: string,
): Promise<PairStatus> {
  const configured = Boolean(config.environments[lowerName]) && Boolean(config.environments[upperName]);
  if (!configured) {
    return { lowerName, upperName, configured, counts: { synced: 0, pending: 0, conflict: 0, total: 0 } };
  }

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, lowerName, upperName),
  );
  const mapping = await mappingStore.load();
  const entries = Object.values(mapping);
  const counts = {
    synced: entries.filter((e) => e.status === "synced").length,
    pending: entries.filter((e) => e.status === "pending").length,
    conflict: entries.filter((e) => e.status === "conflict").length,
    total: entries.length,
  };
  return { lowerName, upperName, configured, counts };
}

/** One PairStatus per adjacent hop in the configured environment chain, in chain order. */
export async function listPairStatuses(config: Config): Promise<PairStatus[]> {
  const chain = config.environmentChain;
  const statuses: PairStatus[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    statuses.push(await getPairStatus(config, chain[i], chain[i + 1]));
  }
  return statuses;
}
