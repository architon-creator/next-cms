import { join } from "node:path";
import type { Config } from "../config.js";
import { canonicalHash } from "../lib/canonical-hash.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
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
  sampleSize?: number;
  fetchImpl?: typeof fetch;
};

export type Phase3Report = {
  passed: boolean;
  countCheck: { devCount: number; sitCount: number; matches: boolean };
  spotCheck: { sampleSize: number; mismatches: string[] };
  brokenLinkScan: { affectedDocuments: Record<string, string[]> };
  assetCheck: { affectedDocuments: Record<string, string[]> };
};

/**
 * Read-only end-to-end verification — nothing here writes to either
 * repository. Fails closed: any mismatch, broken link, or missing asset
 * means `passed: false`, and the CLI exits non-zero on that (Phase 5:
 * "pipeline halts ... on any ... failed verification check").
 */
export async function runPhase3({
  config,
  sampleSize = 20,
  fetchImpl = fetch,
}: Phase3Options): Promise<Phase3Report> {
  log("info", "phase3.start", { sampleSize });

  const mappingStore = new MappingStore<DocumentMapping>(
    join(config.mappingDir, "mapping.json"),
  );
  const assetMappingStore = new MappingStore<AssetMapping>(
    join(config.mappingDir, "asset-mapping.json"),
  );
  const mapping = await mappingStore.load();
  const assetMapping = await assetMappingStore.load();
  const assetIds = Object.fromEntries(
    Object.entries(assetMapping).map(([devId, e]) => [
      devId,
      { id: e.sit_asset_id, url: e.sit_url },
    ]),
  );
  const documentIds = Object.fromEntries(
    Object.entries(mapping).map(([devId, e]) => [devId, e.sit_id]),
  );

  const syncedEntries = Object.entries(mapping).filter(([, e]) => e.status === "synced");

  const devRef = await getMasterRef(config.dev, fetchImpl);
  const sitRef = await getMasterRef(config.sit, fetchImpl);

  // ---- Count check ----
  let devCount = 0;
  for await (const _doc of iterateAllDocuments(config.dev, devRef, fetchImpl))
    devCount += 1;
  const sitCount = syncedEntries.length;
  const countCheck = { devCount, sitCount, matches: devCount === sitCount };
  log("info", "phase3.count_check", countCheck);

  // ---- Spot check ----
  const sample = shuffle(syncedEntries).slice(0, sampleSize);
  const mismatches: string[] = [];
  for (const [devId, entry] of sample) {
    const devDoc = await getDocumentById(config.dev, devRef, devId, fetchImpl);
    const sitDoc = await getDocumentById(config.sit, sitRef, entry.sit_id, fetchImpl);
    if (!devDoc || !sitDoc) {
      mismatches.push(devId);
      continue;
    }
    // Compare rewrite(dev) against sit's actual data, not raw dev vs. sit —
    // sit's ids are rewritten, so a direct hash of the two raw payloads
    // would never match even when the migration is entirely correct.
    //
    // Both sides go through normalizeForComparison() before hashing: a
    // Content Relationship or Image field is denormalized by Prismic at
    // read time with a live snapshot of whatever it currently points at
    // (publish dates, slug, dimensions, url, ...) — that's expected to
    // differ between dev's and sit's own document states even when the
    // reference itself (the `id`) is correctly migrated. The broken-link
    // scan and asset check below are what actually verify `id` resolves
    // to something real; this comparison would otherwise flag every
    // document with a link or image field as a false-positive mismatch
    // (confirmed on a real run via `inspect <devId> <sitId>`).
    const expected = canonicalHash(
      normalizeForComparison(rewriteRefs(devDoc.data, { assetIds, documentIds })),
    );
    const actual = canonicalHash(normalizeForComparison(sitDoc.data));
    if (expected !== actual) mismatches.push(devId);
  }
  log("info", "phase3.spot_check", {
    sampleSize: sample.length,
    mismatches: mismatches.length,
  });

  // ---- Broken-link scan + asset check ----
  const knownSitIds = new Set(Object.values(documentIds));
  const knownSitAssetIds = new Set(
    (await listAssets(config.sit, fetchImpl)).map((a) => a.id),
  );
  const brokenLinks: Record<string, string[]> = {};
  const brokenAssets: Record<string, string[]> = {};

  for (const [, entry] of syncedEntries) {
    const sitDoc = await getDocumentById(config.sit, sitRef, entry.sit_id, fetchImpl);
    if (!sitDoc) continue;
    const unresolvedLinks = findUnresolvedDocumentLinks(sitDoc.data, knownSitIds);
    if (unresolvedLinks.length > 0) brokenLinks[entry.sit_id] = unresolvedLinks;
    const unresolvedAssets = findUnresolvedAssetLinks(sitDoc.data, knownSitAssetIds);
    if (unresolvedAssets.length > 0) brokenAssets[entry.sit_id] = unresolvedAssets;
  }
  log("info", "phase3.broken_link_scan", { affected: Object.keys(brokenLinks).length });
  log("info", "phase3.asset_check", { affected: Object.keys(brokenAssets).length });

  const report: Phase3Report = {
    passed:
      countCheck.matches &&
      mismatches.length === 0 &&
      Object.keys(brokenLinks).length === 0 &&
      Object.keys(brokenAssets).length === 0,
    countCheck,
    spotCheck: { sampleSize: sample.length, mismatches },
    brokenLinkScan: { affectedDocuments: brokenLinks },
    assetCheck: { affectedDocuments: brokenAssets },
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
