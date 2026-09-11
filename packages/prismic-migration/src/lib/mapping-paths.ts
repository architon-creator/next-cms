import { join } from "node:path";

/**
 * Canonical mapping file paths for an adjacent pair — always named
 * `<lower>-<upper>`, regardless of whether the current command is a
 * `migrate` (forward) or a `backsync` (backward). Both directions for a
 * given pair track the identity of the same documents, so they
 * deliberately share one file rather than each direction getting its own
 * — see types.ts's header comment for why fields are named lower/upper
 * rather than source/target.
 */
export function mappingFilePath(
  mappingDir: string,
  lowerName: string,
  upperName: string,
): string {
  return join(mappingDir, `${lowerName}-${upperName}-mapping.json`);
}

export function assetMappingFilePath(
  mappingDir: string,
  lowerName: string,
  upperName: string,
): string {
  return join(mappingDir, `${lowerName}-${upperName}-asset-mapping.json`);
}
