import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ChevronLink,
} from "ui";
import { Blocks } from "../../lib/content-blocks/Blocks";
import { InfoBox } from "../../lib/content-blocks/InfoBox";
import { listRichTextComponents } from "../../lib/content-blocks/lists";
import { richTextLabelComponents } from "../../lib/rich-text-components";
import { definitionRowsClass } from "../../lib/content-blocks/styles";
import { contentClass, iconClass, titleClass, triggerClass } from "./styles";

export type WithCardsProps = {
  slice: Extract<Content.AccordionSlice, { variation: "with_cards" }>;
};

/**
 * One collapsible topic with a free-form `blocks` stream (`with_cards`
 * variation) — one slice instance per topic, stacked in the page's slice
 * zone (like Special Assistance's sections), rather than items of a shared
 * numbered list (see `index.tsx`'s `default` variation for that case).
 *
 * If a topic's content shouldn't collapse at all, use the standalone
 * [`FlexibleContent`](../FlexibleContent/README.md) slice instead — it
 * renders the same `blocks` stream with no trigger.
 *
 * `[&+&]:-mt-px` on the root collapses the 1px border between two adjacent
 * `with_cards` instances into a single line, matching the default variation's
 * one-divider-between-items look; it has no effect next to a different slice.
 */
export default function WithCards({ slice }: WithCardsProps) {
  const { title, note, body, blocks, necessities_heading, necessities, footnote, link, link2, link_label, link2_label } =
    slice.primary;

  return (
    <AccordionRoot
      type="multiple"
      defaultValue={slice.primary.start_expanded ? ["topic"] : []}
      className="pt-[26px] [&+&]:pt-0 [&+&]:-mt-px"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <AccordionItem value="topic" className="border-t! border-b! last:border-b!">
        <AccordionTrigger className={triggerClass}>
          <span className={titleClass}>{title}</span>
          <span aria-hidden="true" className={iconClass}>
            expand_circle_down
          </span>
        </AccordionTrigger>

        <AccordionContent className={contentClass}>
          {note ? (
            <InfoBox className="mb-[29px]">
              <p className="m-0! font-bold leading-6">{note}</p>
            </InfoBox>
          ) : null}

          <PrismicRichText field={body} components={listRichTextComponents} />

          <Blocks blocks={blocks} />

          {isFilled.richText(necessities) ? (
            <>
              {necessities_heading ? (
                <p className="mt-11! mb-3! text-xs leading-[18px]! font-bold">
                  {necessities_heading}
                </p>
              ) : null}
              <InfoBox variant="outline" contentClassName={definitionRowsClass}>
                <PrismicRichText field={necessities} components={richTextLabelComponents} />
              </InfoBox>
            </>
          ) : null}

          {isFilled.richText(footnote) ? (
            <div className="mt-6 text-xs leading-[18px] text-muted-foreground [&_p]:mt-2!">
              <PrismicRichText field={footnote} components={richTextLabelComponents} />
            </div>
          ) : null}

          {isFilled.link(link) ? (
            <ChevronLink field={link} className="mb-0 w-fit pt-2">
              {link_label}
            </ChevronLink>
          ) : null}

          {isFilled.link(link2) ? (
            <ChevronLink field={link2} className="mb-0 w-fit pt-2">
              {link2_label}
            </ChevronLink>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}
