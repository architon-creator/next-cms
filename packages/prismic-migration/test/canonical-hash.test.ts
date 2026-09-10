import { describe, expect, it } from "vitest";
import { canonicalHash, canonicalStringify } from "../src/lib/canonical-hash.js";

describe("canonicalStringify", () => {
  it("produces the same string regardless of key order", () => {
    const a = { b: 1, a: 2, nested: { y: 1, x: 2 } };
    const b = { a: 2, b: 1, nested: { x: 2, y: 1 } };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("preserves array order", () => {
    const a = { list: [1, 2, 3] };
    const b = { list: [3, 2, 1] };
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
  });

  it("sorts keys inside array elements too", () => {
    const a = { list: [{ b: 1, a: 2 }] };
    const b = { list: [{ a: 2, b: 1 }] };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });
});

describe("canonicalHash", () => {
  it("is stable for structurally identical input built in different key orders", () => {
    const a = { title: "Home", data: { seo: { title: "x", desc: "y" } } };
    const b = { data: { seo: { desc: "y", title: "x" } }, title: "Home" };
    expect(canonicalHash(a)).toBe(canonicalHash(b));
  });

  it("changes when a value changes", () => {
    expect(canonicalHash({ title: "Home" })).not.toBe(
      canonicalHash({ title: "Homepage" }),
    );
  });
});
