import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ChevronLink,
} from "ui";
import { InfoBox } from "../../lib/content-blocks/InfoBox";
import { listRichTextComponents } from "../../lib/content-blocks/lists";
import { richTextLabelComponents } from "../../lib/rich-text-components";
import { getOpenValues, itemValue } from "./cards";
import { definitionRowsClass } from "../../lib/content-blocks/styles";
import { contentClass, iconClass, titleClass, triggerClass } from "./styles";
import WithCards from "./WithCards";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice>;

/**
 * Two variations, two different jobs — see the README:
 * - `default`: a numbered (or plain) step-by-step list — one slice instance,
 *   many `items`, all sharing one number sequence and one divider style.
 * - `with_cards`: one topic per slice instance, with a free-form `blocks`
 *   stream (text/image/card/link/button, any order, any count — see
 *   `Blocks.tsx`). Prismic can't nest a Group inside `items`, so a topic that
 *   needs flexible blocks can't be an item of the numbered list; it's its
 *   own instance instead, delegated to `WithCards.tsx`.
 */
export default function Accordion(props: AccordionProps) {
  if (props.slice.variation === "with_cards") {
    return <WithCards slice={props.slice} />;
  }

  return <DefaultSteps slice={props.slice} />;
}

type DefaultStepsProps = { slice: Extract<Content.AccordionSlice, { variation: "default" }> };

function DefaultSteps({ slice }: DefaultStepsProps) {
  const showNumber = !slice.primary.hide_number;

  return (
    <AccordionRoot
      type="multiple"
      defaultValue={getOpenValues(slice.items)}
      className="pt-[26px]"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <AccordionItem
          value={itemValue(index)}
          className="border-t! border-b-0! last:border-b!"
          key={`${item.title}-${index}`}
        >
          <AccordionTrigger className={triggerClass}>
            {showNumber ? (
              <span className="shrink-0 font-bold text-primary">{index + 1}</span>
            ) : null}
            <span className={titleClass}>{item.title}</span>
            {/* Replaces the shared trigger's default chevrons (hidden by triggerClass) — other apps keep those. */}
            <span aria-hidden="true" className={iconClass}>
              expand_circle_down
            </span>
          </AccordionTrigger>

          <AccordionContent className={contentClass}>
            {item.note ? (
              <InfoBox className="mb-[29px]">
                <p className="m-0! font-bold leading-6">{item.note}</p>
              </InfoBox>
            ) : null}

            <PrismicRichText field={item.body} components={listRichTextComponents} />

            {isFilled.richText(item.necessities) ? (
              <>
                {item.necessities_heading ? (
                  <p className="mt-11! mb-3! text-xs leading-[18px]! font-bold">
                    {item.necessities_heading}
                  </p>
                ) : null}
                <InfoBox variant="outline" contentClassName={definitionRowsClass}>
                  <PrismicRichText
                    field={item.necessities}
                    components={richTextLabelComponents}
                  />
                </InfoBox>
              </>
            ) : null}

            {isFilled.link(item.link) ? (
              <ChevronLink field={item.link} className="mb-0 w-fit pt-2">
                {item.link_label}
              </ChevronLink>
            ) : null}

            {isFilled.link(item.link2) ? (
              <ChevronLink field={item.link2} className="mb-0 w-fit pt-2">
                {item.link2_label}
              </ChevronLink>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
