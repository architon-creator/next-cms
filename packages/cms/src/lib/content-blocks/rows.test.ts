import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RichTextField } from "@prismicio/client";

import { splitRows } from "./rows";

const node = (type: string, text: string) =>
  ({ type, text, spans: [], direction: "ltr" }) as unknown as RichTextField[number];

describe("splitRows", () => {
  it("pairs each heading4 with the nodes after it, up to the next heading4", () => {
    const rows = splitRows([
      node("heading4", "Set Route"),
      node("paragraph", "Tokyo⇄Taipei"),
      node("heading4", "Refund"),
      node("paragraph", "Non-refundable."),
      node("paragraph", "Details."),
    ] as RichTextField);

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.label, "Set Route");
    assert.equal(rows[0]?.value.length, 1);
    assert.equal(rows[1]?.label, "Refund");
    assert.equal(rows[1]?.value.length, 2);
  });

  it("gives a row with no label when content precedes the first heading4", () => {
    const rows = splitRows([node("paragraph", "orphaned")] as RichTextField);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.label, "");
    assert.equal(rows[0]?.value.length, 1);
  });

  it("returns no rows for an empty field", () => {
    assert.deepEqual(splitRows([] as RichTextField), []);
  });

  it("keeps a multi-part value (e.g. a bold sub-label plus bullets) as one row", () => {
    const rows = splitRows([
      node("heading4", "Refund"),
      node("paragraph", "Before Flight Departure"),
      node("list-item", "Tokyo-Seoul:5,000 Yen"),
      node("list-item", "Seoul-Tokyo:50,000 Won"),
    ] as RichTextField);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.value.length, 3);
  });
});
