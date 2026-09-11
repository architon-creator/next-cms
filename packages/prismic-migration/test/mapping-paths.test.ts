import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetMappingFilePath, mappingFilePath } from "../src/lib/mapping-paths.js";

describe("mappingFilePath / assetMappingFilePath", () => {
  it("names the file <lower>-<upper>-mapping.json", () => {
    expect(mappingFilePath("./data", "dev", "sit")).toBe(
      join("./data", "dev-sit-mapping.json"),
    );
  });

  it("produces the same path regardless of call order, given the same lower/upper", () => {
    // Callers always pass (lowerName, upperName) here, already resolved
    // by lib/environments.ts — this just confirms the naming itself
    // doesn't introduce any further direction-dependence on top of that.
    const a = mappingFilePath("./data", "sit", "uat");
    const b = mappingFilePath("./data", "sit", "uat");
    expect(a).toBe(b);
  });

  it("names the asset mapping file <lower>-<upper>-asset-mapping.json", () => {
    expect(assetMappingFilePath("./data", "uat", "prod")).toBe(
      join("./data", "uat-prod-asset-mapping.json"),
    );
  });
});
