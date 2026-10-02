import type { RichTextField } from "@prismicio/client";

type RichTextNode = RichTextField[number];

export type Row = { label: string; value: RichTextField };

/**
 * Splits a rich-text field into label/value pairs: every `heading4` is a
 * row's label; the nodes after it, until the next `heading4`, are that row's
 * value (can be several paragraphs and lists — see the Refund row's
 * "Before/After Flight Departure" breakdown). Shared by `SpecBoxList`'s
 * `rows` field and `BoardingProcessStep`'s `info_card` blocks — same shape,
 * different rendering.
 */
export function splitRows(field: RichTextField): Row[] {
  const rows: { label: string; value: RichTextNode[] }[] = [];

  for (const node of field) {
    if (node.type === "heading4") {
      rows.push({ label: node.text, value: [] });
      continue;
    }
    if (rows.length === 0) rows.push({ label: "", value: [] });
    rows.at(-1)?.value.push(node);
  }

  return rows as Row[];
}
