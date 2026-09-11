import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { assetMappingFilePath, mappingFilePath } from "../lib/mapping-paths.js";
import {
  getDocumentById,
  getMasterRef,
  iterateAllDocuments,
  listAssets,
} from "../lib/prismic-http.js";
import {
  findUnresolvedAssetLinks,
  findUnresolvedDocumentLinks,
  normalizeForComparison,
  rewriteRefs,
} from "../lib/rewrite-refs.js";
import type { AssetMapping, DocumentMapping } from "../types.js";

export type Phase3Options = {
  config: Config;
  pair: ResolvedPair;
  sampleSize?: number;
  fetchImpl?: typeof fetch;
};

export type DeletedDocument = {
  lowerId: string;
  upperId: string;
  deletedSide: "lower" | "upper";
};

/**
 * An asset mapping entry whose recorded upper_asset_id no longer exists
 * in the upper environment's asset library — deleted directly there,
 * outside this toolkit. Distinct from `assetCheck` (which only catches a
 * broken *reference* inside a document's data): a migrated asset that's
 * since been deleted, but that no document currently references, would
 * otherwise have nothing to flag it at all — a dangling mapping row
 * `backsync`'s asset step (see phase4-backsync.ts) would also never
 * revisit, since it only walks the upper environment's CURRENT asset
 * list, not this toolkit's own mapping file.
 */
export type DeletedAsset = { lowerAssetId: string; upperAssetId: string };

export type Phase3Report = {
  passed: boolean;
  countCheck: { lowerCount: number; upperCount: number; matches: boolean };
  spotCheck: { sampleSize: number; mismatches: string[] };
  brokenLinkScan: { affectedDocuments: Record<string, string[]> };
  assetCheck: { affectedDocuments: Record<string, string[]> };
  /**
   * A mapping entry marked "synced" whose lower or upper document no
   * longer exists — deleted directly in one environment's dashboard,
   * outside this toolkit. Previously a silent `continue` in both the
   * spot-check and the broken-link/asset scan; now recorded explicitly
   * and counted against `passed`, since a "synced" entry pointing at a
   * document that's actually gone is exactly the kind of drift `verify`
   * exists to catch, not a content difference to lump in with
   * `spotCheck.mismatches`.
   */
  deletedDocuments: DeletedDocument[];
  /** See DeletedAsset's doc comment. */
  deletedAssets: DeletedAsset[];
};

/**
 * Read-only end-to-end verification — nothing here writes to either
 * repository. Fails closed: any mismatch, broken link, or missing asset
 * means `passed: false`, and the CLI exits non-zero on that (Phase 5:
 * "pipeline halts ... on any ... failed verification check").
 */
export async function runPhase3({
  config,
  pair,
  sampleSize = 20,
  fetchImpl = fetch,
}: Phase3Options): Promise<Phase3Report> {
  log("info", "phase3.start", { sampleSize, from: pair.lowerName, to: pair.upperName });

  const mappingStore = new MappingStore<DocumentMapping>(
    mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
  );
  const mapping = await mappingStore.load();
  const assetMapping = await assetMappingStore.load();
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([lowerId, e]) => [
      lowerId,
      { id: e.upper_asset_id, url: e.upper_asset_url },
    ]),
  );
  const documentIds = Object.fromEntries(
    Object.entries(mapping).map(([lowerId, e]) => [lowerId, e.upper_id]),
  );

  const syncedEntries = Object.entries(mapping).filter(([, e]) => e.status === "synced");

  const lowerRef = await getMasterRef(pair.lower, fetchImpl);
  const upperRef = await getMasterRef(pair.upper, fetchImpl);

  // ---- Count check ----
  let lowerCount = 0;
  for await (const _doc of iterateAllDocuments(pair.lower, lowerRef, fetchImpl))
    lowerCount += 1;
  const upperCount = syncedEntries.length;
  const countCheck = { lowerCount, upperCount, matches: lowerCount === upperCount };
  log("info", "phase3.count_check", countCheck);

  // ---- Spot check ----
  const sample = shuffle(syncedEntries).slice(0, sampleSize);
  const mismatches: string[] = [];
  const deletedDocuments: DeletedDocument[] = [];
  const deletedLowerIds = new Set<string>();
  for (const [lowerId, entry] of sample) {
    const lowerDoc = await getDocumentById(pair.lower, lowerRef, lowerId, fetchImpl);
    const upperDoc = await getDocumentById(
      pair.upper,
      upperRef,
      entry.upper_id,
      fetchImpl,
    );
    if (!lowerDoc || !upperDoc) {
      const deletedSide = !lowerDoc ? "lower" : "upper";
      deletedDocuments.push({ lowerId, upperId: entry.upper_id, deletedSide });
      deletedLowerIds.add(lowerId);
      log("warn", "phase3.document_deleted", {
        lowerId,
        upperId: entry.upper_id,
        deletedSide,
      });
      continue;
    }
    // Compare rewrite(lower) against upper's actual data, not raw lower vs.
    // upper — upper's ids are rewritten, so a direct hash of the two raw
    // payloads would never match even when the migration is entirely
    // correct.
    //
    // Both sides go through normalizeForComparison() before hashing: a
    // Content Relationship or Image field is denormalized by Prismic at
    // read time with a live snapshot of whatever it currently points at
    // (publish dates, slug, dimensions, url, ...) — that's expected to
    // differ between the lower and upper environments' own document
    // states even when the reference itself (the `id`) is correctly
    // migrated. The broken-link scan and asset check below are what
    // actually verify `id` resolves to something real; this comparison
    // would otherwise flag every document with a link or image field as
    // a false-positive mismatch (confirmed on a real run via
    // `inspect <lowerId> <upperId>`).
    const expected = canonicalHash(
      normalizeForComparison(rewriteRefs(lowerDoc.data, { assetIds, documentIds })),
    );
    const actual = canonicalHash(normalizeForComparison(upperDoc.data));
    if (expected !== actual) mismatches.push(lowerId);
  }
  log("info", "phase3.spot_check", {
    sampleSize: sample.length,
    mismatches: mismatches.length,
  });

  // ---- Broken-link scan + asset check ----
  const knownUpperIds = new Set(Object.values(documentIds));
  const knownUpperAssetIds = new Set(
    (await listAssets(pair.upper, fetchImpl)).map((a) => a.id),
  );
  const brokenLinks: Record<string, string[]> = {};
  const brokenAssets: Record<string, string[]> = {};

  // ---- Deleted-asset check ----
  // Every migrated asset should still exist in the upper environment's
  // library, independent of whether any document currently references
  // it — a document could have had that image swapped out or removed
  // since the asset was migrated, which would otherwise leave a deleted
  // asset with nothing to flag it (see DeletedAsset's doc comment).
  const deletedAssets: DeletedAsset[] = [];
  for (const [lowerAssetId, assetEntry] of Object.entries(assetMapping)) {
    if (!knownUpperAssetIds.has(assetEntry.upper_asset_id)) {
      deletedAssets.push({ lowerAssetId, upperAssetId: assetEntry.upper_asset_id });
      log("warn", "phase3.asset_deleted", {
        lowerAssetId,
        upperAssetId: assetEntry.upper_asset_id,
      });
    }
  }
  log("info", "phase3.deleted_assets", { count: deletedAssets.length });

  for (const [lowerId, entry] of syncedEntries) {
    const upperDoc = await getDocumentById(
      pair.upper,
      upperRef,
      entry.upper_id,
      fetchImpl,
    );
    if (!upperDoc) {
      // Same deletion as the spot-check above, but this loop covers every
      // synced entry, not just the random sample — dedupe against
      // anything the spot-check already caught rather than double-report.
      if (!deletedLowerIds.has(lowerId)) {
        deletedDocuments.push({ lowerId, upperId: entry.upper_id, deletedSide: "upper" });
        deletedLowerIds.add(lowerId);
        log("warn", "phase3.document_deleted", {
          lowerId,
          upperId: entry.upper_id,
          deletedSide: "upper",
        });
      }
      continue;
    }
    const unresolvedLinks = findUnresolvedDocumentLinks(upperDoc.data, knownUpperIds);
    if (unresolvedLinks.length > 0) brokenLinks[entry.upper_id] = unresolvedLinks;
    const unresolvedAssets = findUnresolvedAssetLinks(upperDoc.data, knownUpperAssetIds);
    if (unresolvedAssets.length > 0) brokenAssets[entry.upper_id] = unresolvedAssets;
  }
  log("info", "phase3.broken_link_scan", { affected: Object.keys(brokenLinks).length });
  log("info", "phase3.asset_check", { affected: Object.keys(brokenAssets).length });
  log("info", "phase3.deleted_documents", { count: deletedDocuments.length });

  const report: Phase3Report = {
    passed:
      countCheck.matches &&
      mismatches.length === 0 &&
      Object.keys(brokenLinks).length === 0 &&
      Object.keys(brokenAssets).length === 0 &&
      deletedDocuments.length === 0 &&
      deletedAssets.length === 0,
    countCheck,
    spotCheck: { sampleSize: sample.length, mismatches },
    brokenLinkScan: { affectedDocuments: brokenLinks },
    assetCheck: { affectedDocuments: brokenAssets },
    deletedDocuments,
    deletedAssets,
  };

  log(report.passed ? "info" : "error", "phase3.done", { passed: report.passed });
  return report;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
