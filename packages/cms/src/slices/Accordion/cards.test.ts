import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RichTextField } from "@prismicio/client";

import { getOpenValues, hasRomanLabel, itemValue, resolveDownloadsIndex, splitSegments } from "./cards";

const node = (type: string, text: string) =>
  ({ type, text, spans: [], direction: "ltr" }) as unknown as RichTextField[number];

describe("splitSegments", () => {
  it("starts a new boxed card at every heading4", () => {
    const segments = splitSegments([
      node("heading4", "A"),
      node("paragraph", "a1"),
      node("heading4", "B"),
      node("paragraph", "b1"),
      node("list-item", "b2"),
    ] as RichTextField);

    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.boxed, true);
    assert.equal(segments[0]?.nodes.length, 2);
    assert.equal(segments[1]?.boxed, true);
    assert.equal(segments[1]?.nodes.length, 3);
  });

  it("keeps content before the first heading4 as its own boxed card", () => {
    const segments = splitSegments([
      node("paragraph", "intro"),
      node("heading4", "A"),
    ] as RichTextField);

    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.boxed, true);
    assert.equal(segments[0]?.nodes.length, 1);
  });

  it("drops out of the box after a heading5, until the next heading4", () => {
    const segments = splitSegments([
      node("heading4", "A"),
      node("paragraph", "a1"),
      node("heading5", "Loose section"),
      node("paragraph", "loose"),
      node("heading4", "B"),
      node("paragraph", "b1"),
    ] as RichTextField);

    assert.deepEqual(
      segments.map((s) => s.boxed),
      [true, false, true],
    );
    assert.equal(segments[1]?.nodes.length, 2);
  });

  it("drops empty segments (a heading4/heading5 with nothing else after it)", () => {
    const segments = splitSegments([node("heading5", "Loose")] as RichTextField);
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.boxed, false);
    assert.equal(segments[0]?.nodes.length, 1);
  });

  it("returns no segments for an empty field", () => {
    assert.deepEqual(splitSegments([] as RichTextField), []);
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
