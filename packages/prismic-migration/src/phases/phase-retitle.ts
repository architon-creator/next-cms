import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { assetMappingFilePath, mappingFilePath } from "../lib/mapping-paths.js";
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
  pair: ResolvedPair;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
};

export type RetitleResult = {
  retitled: number;
  /** The lower document changed since the original migration — needs a real `migrate` re-sync, not just a retitle. */
  skippedChanged: number;
  skippedMissing: number;
  /** status: "conflict" — see the guard below; never touched here regardless of hash. */
  skippedConflict: number;
};

/**
 * One-time fix-up for documents created before buildTitle() existed: any
 * document with no `uid` got the raw lower-environment document id as
 * its display title in the upper environment's Migration Release list
 * ("aoWn_hEAAC0AMB8Q"). Targets exactly the mapping entries that could
 * have hit that bug (`!entry.uid`).
 *
 * Never guesses at a currently-unpublished draft's content — these
 * documents are still Planned/unpublished, so the content API (master-ref
 * only) can't see them anyway. Instead this re-derives the exact same
 * data payload the original migration would have produced from the
 * lower document's CURRENT content, and only writes when that recomputed
 * hash still matches `lower_hash` (i.e. the lower document hasn't
 * changed since the original run) — so the PUT changes nothing but the
 * title. If the lower document has changed, this skips it entirely and
 * says so: run `migrate` for that one instead, which re-syncs the real
 * content and corrects the title in the same PUT (see phase2-migrate.ts).
 *
 * Run with --dry-run first — it logs every title this would set without
 * writing anything.
 */
export async function runRetitle({
  config,
  pair,
  dryRun,
  fetchImpl = fetch,
}: RetitleOptions): Promise<RetitleResult> {
  log("info", "retitle.start", { dryRun, from: pair.lowerName, to: pair.upperName });

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMapping = await assetMappingStore.load();
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([lowerId, e]) => [
      lowerId,
      { id: e.upper_asset_id, url: e.upper_asset_url },
    ]),
  );

  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const typeInfo = new Map(
    (await listCustomTypes(pair.lower, fetchImpl)).map((t) => [
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
      Object.entries(mapping).map(([lowerId, e]) => [lowerId, e.upper_id]),
    );

    for (const [lowerId, entry] of Object.entries(mapping)) {
      if (entry.uid) continue; // only entries that could have hit the bug

      if (entry.status === "conflict") {
        // A conflict entry (from `link` or `reconcile`) means the lower
        // document's content was deliberately never written to this
        // document — the upper environment's current content is
        // unreviewed and may not match the lower side at all. lower_hash
        // matching here proves nothing about that; only that the lower
        // document hasn't changed SINCE the entry was linked. Retitling
        // would still send a PUT carrying the lower document's full
        // data, silently overwriting whatever is actually in the upper
        // environment. Skipped unconditionally — resolve the conflict
        // (or accept it) before this document's title is worth touching.
        result.skippedConflict += 1;
        log("warn", "retitle.skipped_conflict", { lowerId, upperId: entry.upper_id });
        continue;
      }

      const lowerDoc = await getDocumentById(pair.lower, lowerRef, lowerId, fetchImpl);
      if (!lowerDoc) {
        result.skippedMissing += 1;
        log("warn", "retitle.lower_document_missing", { lowerId, upperId: entry.upper_id });
        continue;
      }

      const currentLowerHash = canonicalHash(lowerDoc.data);
      if (currentLowerHash !== entry.lower_hash) {
        result.skippedChanged += 1;
        log("warn", "retitle.lower_changed_since_migration", {
          lowerId,
          upperId: entry.upper_id,
        });
        continue;
      }

      const rewritten = rewriteRefs(lowerDoc.data, { assetIds, documentIds });
      const title = buildTitle(lowerDoc, typeInfo);

      log("info", dryRun ? "retitle.would_retitle" : "retitle.retitled", {
        lowerId,
        upperId: entry.upper_id,
        title,
      });
      if (dryRun) continue;

      await updateMigrationDocument(
        pair.upper,
        entry.upper_id,
        { uid: entry.uid, data: rewritten, title },
        fetchImpl,
      );
      mapping[lowerId] = { ...entry, upper_hash: canonicalHash(rewritten) };
      result.retitled += 1;
    }
    return mapping;
  });

  log("info", "retitle.done", result);
  return result;
}
