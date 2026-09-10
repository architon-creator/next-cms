import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import {
  getDocumentById,
  getMasterRef,
  listCustomTypes,
  updateMigrationDocument,
} from "../lib/prismic-http.js";
import { rewriteRefs } from "../lib/rewrite-refs.js";
import { buildTitle } from "./phase2-migrate.js";
import type { AssetMapping, DocumentMapping } from "../types.js";

export type RetitleOptions = {
  config: Config;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type RetitleResult = {
  retitled: number;
  /** Dev changed since the original migration — needs a real `migrate` re-sync, not just a retitle. */
  skippedChanged: number;
  skippedMissing: number;
  /** status: "conflict" — see the guard below; never touched here regardless of hash. */
  skippedConflict: number;
};

/**
 * One-time fix-up for documents created before buildTitle() existed: any
 * document with no `uid` got the raw dev document id as its display title
 * in sit's Migration Release list ("aoWn_hEAAC0AMB8Q"). Targets exactly
 * the mapping entries that could have hit that bug (`!entry.uid`).
 *
 * Never guesses at a currently-unpublished draft's content — these
 * documents are still Planned/unpublished, so the content API (master-ref
 * only) can't see them anyway. Instead this re-derives the exact same
 * data payload the original migration would have produced from dev's
 * CURRENT content, and only writes when that recomputed hash still
 * matches `dev_hash` (i.e. dev hasn't changed since the original run) —
 * so the PUT changes nothing but the title. If dev has changed, this
 * skips the document entirely and says so: run `migrate` for that one
 * instead, which re-syncs the real content and corrects the title in the
 * same PUT (see phase2-migrate.ts).
 *
 * Run with --dry-run first — it logs every title this would set without
 * writing anything.
 */
export async function runRetitle({
  config,
  dryRun,
  fetchImpl = fetch,
}: RetitleOptions): Promise<RetitleResult> {
  log("info", "retitle.start", { dryRun });

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    join(config.mappingDir, "asset-mapping.json"),
  );
  const assetMapping = await assetMappingStore.load();
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([devId, e]) => [
      devId,
      { id: e.sit_asset_id, url: e.sit_url },
    ]),
  );

  const devRef = await getMasterRef(config.dev, fetchImpl);
  const typeInfo = new Map(
    (await listCustomTypes(config.dev, fetchImpl)).map((t) => [
      t.id,
      { label: t.label, repeatable: t.repeatable },
    ]),
  );

  const result: RetitleResult = {
    retitled: 0,
    skippedChanged: 0,
    skippedMissing: 0,
    skippedConflict: 0,
  };

  await mappingStore.mutate(async (mapping) => {
    const documentIds = Object.fromEntries(
      Object.entries(mapping).map(([devId, e]) => [devId, e.sit_id]),
    );

    for (const [devId, entry] of Object.entries(mapping)) {
      if (entry.uid) continue; // only entries that could have hit the bug

      if (entry.status === "conflict") {
        // A conflict entry (from `link` or `reconcile`) means dev's content
        // was deliberately never written to this document — sit's current
        // content is unreviewed and may not match dev at all. dev_hash
        // matching here proves nothing about that; only that dev hasn't
        // changed SINCE the entry was linked. Retitling would still send a
        // PUT carrying dev's full data, silently overwriting whatever is
        // actually in sit. Skipped unconditionally — resolve the conflict
        // (or accept it) before this document's title is worth touching.
        result.skippedConflict += 1;
        log("warn", "retitle.skipped_conflict", { devId, sitId: entry.sit_id });
        continue;
      }

      const devDoc = await getDocumentById(config.dev, devRef, devId, fetchImpl);
      if (!devDoc) {
        result.skippedMissing += 1;
        log("warn", "retitle.dev_document_missing", { devId, sitId: entry.sit_id });
        continue;
      }

      const currentDevHash = canonicalHash(devDoc.data);
      if (currentDevHash !== entry.dev_hash) {
        result.skippedChanged += 1;
        log("warn", "retitle.dev_changed_since_migration", {
          devId,
          sitId: entry.sit_id,
        });
        continue;
      }

      const rewritten = rewriteRefs(devDoc.data, { assetIds, documentIds });
      const title = buildTitle(devDoc, typeInfo);

      log("info", dryRun ? "retitle.would_retitle" : "retitle.retitled", {
        devId,
        sitId: entry.sit_id,
        title,
      });
      if (dryRun) continue;

      await updateMigrationDocument(
        config.sit,
        entry.sit_id,
        { uid: entry.uid, data: rewritten, title },
        fetchImpl,
      );
      mapping[devId] = { ...entry, sit_hash: canonicalHash(rewritten) };
      result.retitled += 1;
    }
    return mapping;
  });

  log("info", "retitle.done", result);
  return result;
}
