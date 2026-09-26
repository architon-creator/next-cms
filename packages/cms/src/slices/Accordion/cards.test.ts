import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RichTextField } from "@prismicio/client";

import { getOpenValues, itemValue, resolveDownloadsIndex, splitCards } from "./cards";

const node = (type: string, text: string) =>
  ({ type, text, spans: [], direction: "ltr" }) as unknown as RichTextField[number];

describe("splitCards", () => {
  it("starts a new card at every heading4", () => {
    const cards = splitCards([
      node("heading4", "A"),
      node("paragraph", "a1"),
      node("heading4", "B"),
      node("paragraph", "b1"),
      node("list-item", "b2"),
    ] as RichTextField);

    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.length, 2);
    assert.equal(cards[1]?.length, 3);
  });

  it("keeps content before the first heading4 as its own card", () => {
    const cards = splitCards([
      node("paragraph", "intro"),
      node("heading4", "A"),
    ] as RichTextField);

    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.length, 1);
  });

  it("returns no cards for an empty field", () => {
    assert.deepEqual(splitCards([] as RichTextField), []);
  });
});

describe("resolveDownloadsIndex", () => {
  it("uses the requested 1-based card", () => {
    assert.equal(resolveDownloadsIndex(2, 3), 1);
    assert.equal(resolveDownloadsIndex(1, 3), 0);
  });

  it("falls back to the last card when blank", () => {
    assert.equal(resolveDownloadsIndex(null, 3), 2);
    assert.equal(resolveDownloadsIndex(undefined, 3), 2);
  });

  it("falls back to the last card when out of range or not an integer", () => {
    assert.equal(resolveDownloadsIndex(0, 3), 2);
    assert.equal(resolveDownloadsIndex(4, 3), 2);
    assert.equal(resolveDownloadsIndex(1.5, 3), 2);
  });

  it("returns 0 when there are no cards", () => {
    assert.equal(resolveDownloadsIndex(null, 0), 0);
  });
});

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
