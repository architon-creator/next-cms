import { join } from "node:path";
import type { Config } from "../config.js";
import { log } from "../lib/logger.js";
import { MappingStore } from "../lib/mapping-store.js";
import {
  insertCustomType,
  listCustomTypes,
  updateCustomType,
} from "../lib/prismic-http.js";
import { canonicalStringify } from "../lib/canonical-hash.js";
import { takeSnapshot } from "../lib/snapshot.js";
import type { AssetMapping, DocumentMapping, PrismicCustomType } from "../types.js";

export type CustomTypeDiff = {
  missing: PrismicCustomType[];
  differing: { id: string; dev: PrismicCustomType; sit: PrismicCustomType }[];
};

/**
 * Pure diff — no network calls — so it's directly unit-testable. Compares
 * custom types by canonical JSON of their `json` schema; a custom type
 * present in both but with a different schema is "differing", one absent
 * from sit entirely is "missing".
 */
export function diffCustomTypes(
  devTypes: PrismicCustomType[],
  sitTypes: PrismicCustomType[],
): CustomTypeDiff {
  const sitById = new Map(sitTypes.map((t) => [t.id, t]));
  const missing: PrismicCustomType[] = [];
  const differing: CustomTypeDiff["differing"] = [];

  for (const dev of devTypes) {
    const sit = sitById.get(dev.id);
    if (!sit) {
      missing.push(dev);
    } else if (canonicalStringify(dev.json) !== canonicalStringify(sit.json)) {
      differing.push({ id: dev.id, dev, sit });
    }
  }

  return { missing, differing };
}

export type Phase0Options = {
  config: Config;
  dryRun: boolean;
};

export async function runPhase0({ config, dryRun }: Phase0Options): Promise<void> {
  log("info", "phase0.start", { dryRun });

  const [devTypes, sitTypes] = await Promise.all([
    listCustomTypes(config.dev),
    listCustomTypes(config.sit),
  ]);
  const diff = diffCustomTypes(devTypes, sitTypes);

  log("info", "phase0.custom_type_diff", {
    missing: diff.missing.map((t) => t.id),
    differing: diff.differing.map((t) => t.id),
  });

  if (diff.missing.length === 0 && diff.differing.length === 0) {
    log("info", "phase0.schema_parity_confirmed");
  } else if (dryRun) {
    log("warn", "phase0.schema_parity_pending_dry_run", {
      missing: diff.missing.length,
      differing: diff.differing.length,
    });
  } else {
    for (const type of diff.missing) {
      await insertCustomType(config.sit, type);
      log("info", "phase0.custom_type_inserted", { id: type.id });
    }
    for (const { id, dev } of diff.differing) {
      await updateCustomType(config.sit, dev);
      log("info", "phase0.custom_type_updated", { id });
    }
  }

  // Restore point — taken regardless of dry-run, since it's read-only.
  const devSnapshot = await takeSnapshot(config.dev, "dev", config.snapshotDir);
  const sitSnapshot = await takeSnapshot(config.sit, "sit", config.snapshotDir);
  log("info", "phase0.snapshots_taken", { devSnapshot, sitSnapshot });

  if (!dryRun) {
    const mappingStore = new MappingStore<DocumentMapping>(
      join(config.mappingDir, "mapping.json"),
    );
    await mappingStore.mutate((current) => current); // creates the file if absent, never overwrites existing entries
    const assetMappingStore = new MappingStore<AssetMapping>(
      join(config.mappingDir, "asset-mapping.json"),
    );
    await assetMappingStore.mutate((current) => current);
    log("info", "phase0.mapping_initialized");
  }

  log("info", "phase0.done", { dryRun });
}
