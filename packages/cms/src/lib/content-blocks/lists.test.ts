import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasRomanLabel } from "./lists";

describe("hasRomanLabel", () => {
  const item = (...spans: { type: string; data?: unknown }[]) => ({ spans });

  it("is true when any item has the roman label", () => {
    assert.equal(
      hasRomanLabel([item(), item({ type: "label", data: { label: "roman" } })]),
      true,
    );
  });

  it("is false for other labels, other span types, or no spans", () => {
    assert.equal(hasRomanLabel([item({ type: "label", data: { label: "muted" } })]), false);
    assert.equal(hasRomanLabel([item({ type: "strong" })]), false);
    assert.equal(hasRomanLabel([item()]), false);
    assert.equal(hasRomanLabel([]), false);
  });
});
