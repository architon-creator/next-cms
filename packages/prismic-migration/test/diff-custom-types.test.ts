import { describe, expect, it } from "vitest";
import { diffCustomTypes } from "../src/phases/phase0-preflight.js";
import type { PrismicCustomType } from "../src/types.js";

function type(id: string, json: unknown): PrismicCustomType {
  return { id, label: id, repeatable: false, status: true, json };
}

describe("diffCustomTypes", () => {
  it("reports a custom type present in dev but absent from sit as missing", () => {
    const diff = diffCustomTypes([type("homepage", { a: 1 })], []);
    expect(diff.missing.map((t) => t.id)).toEqual(["homepage"]);
    expect(diff.differing).toEqual([]);
  });

  it("reports a custom type present in both with a different schema as differing", () => {
    const diff = diffCustomTypes(
      [type("homepage", { a: 1 })],
      [type("homepage", { a: 2 })],
    );
    expect(diff.missing).toEqual([]);
    expect(diff.differing.map((d) => d.id)).toEqual(["homepage"]);
  });

  it("reports no diff when schemas are structurally identical but key-ordered differently", () => {
    const diff = diffCustomTypes(
      [type("homepage", { a: 1, b: 2 })],
      [type("homepage", { b: 2, a: 1 })],
    );
    expect(diff.missing).toEqual([]);
    expect(diff.differing).toEqual([]);
  });

  it("does not flag a custom type only present in sit", () => {
    const diff = diffCustomTypes([], [type("legacy", { a: 1 })]);
    expect(diff.missing).toEqual([]);
    expect(diff.differing).toEqual([]);
  });
});
