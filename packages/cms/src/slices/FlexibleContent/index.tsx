import { Content } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { Blocks } from "../../lib/content-blocks/Blocks";
import { listRichTextComponents } from "../../lib/content-blocks/lists";

export type FlexibleContentProps = SliceComponentProps<Content.FlexibleContentSlice>;

/**
 * The always-visible sibling of Accordion's `with_cards` variation: the same
 * `blocks` stream (text/image/card/link/button, any order, any count — see
 * `Blocks.tsx`), with no trigger and no collapse. Use this when a section's
 * content should just be shown, and Accordion's `with_cards` when it should
 * be a collapsible topic instead.
 */
export default function FlexibleContent({ slice }: FlexibleContentProps) {
  const { title, body, blocks } = slice.primary;

  return (
    <section
      className="mt-6"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {title ? <p className="mb-4 text-lg font-bold text-ink">{title}</p> : null}

      <PrismicRichText field={body} components={listRichTextComponents} />

      <Blocks blocks={blocks} />
    </section>
  );
}
