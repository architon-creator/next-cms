import type { Config } from "../config.js";
import { canonicalStringify } from "../lib/canonical-hash.js";
import type { ResolvedPair } from "../lib/environments.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import { assetMappingFilePath, mappingFilePath } from "../lib/mapping-paths.js";
import {
  insertCustomType,
  insertSharedSlice,
  listCustomTypes,
  listSharedSlices,
  updateCustomType,
  updateSharedSlice,
} from "../lib/prismic-http.js";
import { takeSnapshot } from "../lib/snapshot.js";
import type {
  AssetMapping,
  DocumentMapping,
  PrismicCustomType,
  PrismicSharedSlice,
} from "../types.js";

export type CustomTypeDiff = {
  missing: PrismicCustomType[];
  differing: { id: string; lower: PrismicCustomType; upper: PrismicCustomType }[];
};

export type SharedSliceDiff = {
  missing: PrismicSharedSlice[];
  differing: { id: string; lower: PrismicSharedSlice; upper: PrismicSharedSlice }[];
};

/**
 * Same shape as diffCustomTypes, for the separate Shared Slices
 * resource — see lib/prismic-http.ts's "Shared Slices" section for why
 * this has to be diffed/pushed independently of custom types at all. A
 * custom type's Slice Zone referencing a slice by id that doesn't exist
 * on the upper environment pushes and updates just fine; only a
 * document actually using that slice fails, with a 400 easy to misread
 * as a custom-type schema problem when the real gap is here.
 */
export function diffSharedSlices(
  lowerSlices: PrismicSharedSlice[],
  upperSlices: PrismicSharedSlice[],
): SharedSliceDiff {
  const upperById = new Map(upperSlices.map((s) => [s.id, s]));
  const missing: PrismicSharedSlice[] = [];
  const differing: SharedSliceDiff["differing"] = [];

  for (const lower of lowerSlices) {
    const upper = upperById.get(lower.id);
    if (!upper) {
      missing.push(lower);
    } else if (canonicalStringify(lower) !== canonicalStringify(upper)) {
      differing.push({ id: lower.id, lower, upper });
    }
  }

  return { missing, differing };
}

/**
 * Pure diff — no network calls — so it's directly unit-testable. Compares
 * custom types by canonical JSON of their `json` schema; a custom type
 * present in both but with a different schema is "differing", one absent
 * from the upper environment entirely is "missing". Always pushes
 * lower -> upper, matching `migrate`'s own direction — schema promotion
 * follows the same one-hop chain as content.
 */
export function diffCustomTypes(
  lowerTypes: PrismicCustomType[],
  upperTypes: PrismicCustomType[],
): CustomTypeDiff {
  const upperById = new Map(upperTypes.map((t) => [t.id, t]));
  const missing: PrismicCustomType[] = [];
  const differing: CustomTypeDiff["differing"] = [];

  for (const lower of lowerTypes) {
    const upper = upperById.get(lower.id);
    if (!upper) {
      missing.push(lower);
    } else if (canonicalStringify(lower.json) !== canonicalStringify(upper.json)) {
      differing.push({ id: lower.id, lower, upper });
    }
  }

  return { missing, differing };
}

export type Phase0Options = {
  config: Config;
  pair: ResolvedPair;
  dryRun: boolean;
};

export async function runPhase0({ config, pair, dryRun }: Phase0Options): Promise<void> {
  log("info", "phase0.start", { dryRun, from: pair.lowerName, to: pair.upperName });

  // Slices before custom types: not because Prismic enforces that
  // order (confirmed on a real run that it doesn't — a custom type
  // referencing a not-yet-existing slice pushes fine), but so a fresh
  // upper environment's slice library is already complete by the time
  // Phase 2 tries to write any document using one.
  const [lowerSlices, upperSlices] = await Promise.all([
    listSharedSlices(pair.lower),
    listSharedSlices(pair.upper),
  ]);
  const sliceDiff = diffSharedSlices(lowerSlices, upperSlices);

  log("info", "phase0.shared_slice_diff", {
    missing: sliceDiff.missing.map((s) => s.id),
    differing: sliceDiff.differing.map((s) => s.id),
  });

  const slicesNeedWork = sliceDiff.missing.length > 0 || sliceDiff.differing.length > 0;
  if (slicesNeedWork && dryRun) {
    log("warn", "phase0.shared_slice_parity_pending_dry_run", {
      missing: sliceDiff.missing.length,
      differing: sliceDiff.differing.length,
    });
  } else if (slicesNeedWork) {
    for (const slice of sliceDiff.missing) {
      await insertSharedSlice(pair.upper, slice);
      log("info", "phase0.shared_slice_inserted", { id: slice.id });
    }
    for (const { id, lower } of sliceDiff.differing) {
      await updateSharedSlice(pair.upper, lower);
      log("info", "phase0.shared_slice_updated", { id });
    }
  }

  const [lowerTypes, upperTypes] = await Promise.all([
    listCustomTypes(pair.lower),
    listCustomTypes(pair.upper),
  ]);
  const diff = diffCustomTypes(lowerTypes, upperTypes);

  log("info", "phase0.custom_type_diff", {
    missing: diff.missing.map((t) => t.id),
    differing: diff.differing.map((t) => t.id),
  });

  if (diff.missing.length === 0 && diff.differing.length === 0 && !slicesNeedWork) {
    log("info", "phase0.schema_parity_confirmed");
  } else if (dryRun) {
    log("warn", "phase0.schema_parity_pending_dry_run", {
      missing: diff.missing.length,
      differing: diff.differing.length,
    });
  } else {
    for (const type of diff.missing) {
      await insertCustomType(pair.upper, type);
      log("info", "phase0.custom_type_inserted", { id: type.id });
    }
    for (const { id, lower } of diff.differing) {
      await updateCustomType(pair.upper, lower);
      log("info", "phase0.custom_type_updated", { id });
    }
  }

  // Restore point — taken regardless of dry-run, since it's read-only.
  // Labeled with the real environment name (not "lower"/"upper") so a
  // uat snapshot is actually named uat-<timestamp>.json, not something
  // generic that loses which environment it came from.
  const lowerSnapshot = await takeSnapshot(
    pair.lower,
    pair.lowerName,
    config.snapshotDir,
  );
  const upperSnapshot = await takeSnapshot(
    pair.upper,
    pair.upperName,
    config.snapshotDir,
  );
  log("info", "phase0.snapshots_taken", { lowerSnapshot, upperSnapshot });

  if (!dryRun) {
    const mappingStore = new MappingStore<DocumentMapping>(
      mappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    await mappingStore.mutate((current) => current); // creates the file if absent, never overwrites existing entries
    const assetMappingStore = new MappingStore<AssetMapping>(
      assetMappingFilePath(config.mappingDir, pair.lowerName, pair.upperName),
    );
    await assetMappingStore.mutate((current) => current);
    log("info", "phase0.mapping_initialized");
  }

  log("info", "phase0.done", { dryRun });
}
