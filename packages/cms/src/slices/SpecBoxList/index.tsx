import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { InfoBox } from "../../lib/content-blocks/InfoBox";
import { definitionRowsClass } from "../../lib/content-blocks/styles";
import { richTextLabelComponents } from "../../lib/rich-text-components";

export type SpecBoxListProps = SliceComponentProps<Content.SpecBoxListSlice>;

/**
 * A stack of bordered definition-list boxes — each item is one box, its
 * `rows` field a sequence of Heading 4 (label) / paragraph (value) pairs, the
 * same convention as Accordion's `necessities` field (see
 * `lib/content-blocks/styles.ts`'s `definitionRowsClass`). Built for pages
 * like a fare rule table: several named boxes, each a small spec sheet.
 */
export default function SpecBoxList({ slice }: SpecBoxListProps) {
  return (
    <div
      className="mt-6 flex flex-col gap-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <div id={item.anchor_id || undefined} key={`${item.label}-${index}`}>
          {item.label ? (
            <p className="mb-3 text-xs font-bold first:mt-0">{item.label}</p>
          ) : null}

          {isFilled.richText(item.rows) ? (
            <InfoBox variant="outline" contentClassName={definitionRowsClass}>
              <PrismicRichText field={item.rows} components={richTextLabelComponents} />
            </InfoBox>
          ) : null}
        </div>
      ))}
    </div>
  );
}
