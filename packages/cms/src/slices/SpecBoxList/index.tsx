import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { richTextLabelComponents } from "../../lib/rich-text-components";
import { splitRows } from "../../lib/content-blocks/rows";

export type SpecBoxListProps = SliceComponentProps<Content.SpecBoxListSlice>;

/**
 * A stack of definition tables — each item is one table, its `rows` field
 * split (see `rows.ts`) into label/value pairs and rendered as a genuine
 * 2-column grid row (label cell left, value cell right), not a stacked box.
 * Unlike Accordion's `necessities` (which really is stacked bold-label-then-
 * text), the Fare Rule Table design this slice was built for is a table with
 * row dividers and a shaded label column — don't reuse `definitionRowsClass`
 * here, the two look different.
 */
export default function SpecBoxList({ slice }: SpecBoxListProps) {
  return (
    <div
      className="mt-6 flex flex-col gap-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => {
        const rows = isFilled.richText(item.rows) ? splitRows(item.rows) : [];
        if (rows.length === 0 && !item.label) return null;

        return (
          <div id={item.anchor_id || undefined} key={`${item.label}-${index}`}>
            {item.label ? <p className="mb-3 text-xs font-bold">{item.label}</p> : null}

            {rows.length > 0 ? (
              <div className="overflow-hidden rounded border">
                {rows.map((row, rowIndex) => (
                  <div
                    className="grid grid-cols-[140px_1fr] border-b last:border-b-0"
                    key={rowIndex}
                  >
                    <div className="bg-muted px-5 py-4 text-sm font-bold">{row.label}</div>
                    <div className="px-5 py-4 text-sm text-muted-foreground [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p:last-child]:mb-0 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
                      <PrismicRichText field={row.value} components={richTextLabelComponents} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
