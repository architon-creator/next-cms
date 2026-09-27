import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getOpenValues, itemValue } from "./cards";

describe("getOpenValues", () => {
  it("starts every item collapsed by default (no value set)", () => {
    assert.deepEqual(getOpenValues([{}, {}, {}] as never), []);
  });

  it("expands only the items marked start_expanded", () => {
    assert.deepEqual(
      getOpenValues([{ start_expanded: false }, { start_expanded: true }, { start_expanded: null }, { start_expanded: true }]),
      ["item-1", "item-3"],
    );
  });

  it("expands everything when every item is marked", () => {
    assert.deepEqual(getOpenValues([{ start_expanded: true }, { start_expanded: true }]), ["item-0", "item-1"]);
  });

  it("uses the same value format as the item keys", () => {
    assert.equal(itemValue(4), "item-4");
  });
});
