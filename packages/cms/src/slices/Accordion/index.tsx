import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ChevronLink,
} from "ui";
import { richTextLabelComponents } from "../../lib/rich-text-components";
import type { SliceContext } from "../types";
import { InfoBox } from "./InfoBox";
import { ItemBoxes } from "./ItemBoxes";
import {
  contentClass,
  iconClass,
  necessitiesContentClass,
  titleClass,
  triggerClass,
} from "./styles";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice, SliceContext>;

const DEFAULT_FILE_SIZE_LABEL = "File Size";

export default function Accordion({ slice, context }: AccordionProps) {
  const showNumber = !slice.primary.hide_number;
  const fileSizeLabel = context?.labels?.fileSize ?? DEFAULT_FILE_SIZE_LABEL;

  return (
    <AccordionRoot
      type="multiple"
      defaultValue={slice.items.map((_, index) => `item-${index}`)}
      className="pt-[26px]"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <AccordionItem
          value={`item-${index}`}
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

            <PrismicRichText field={item.body} components={richTextLabelComponents} />

            <ItemBoxes item={item} fileSizeLabel={fileSizeLabel} />

            {isFilled.richText(item.necessities) ? (
              <>
                {item.necessities_heading ? (
                  <p className="mt-11! mb-3! text-xs leading-[18px]! font-bold">
                    {item.necessities_heading}
                  </p>
                ) : null}
                <InfoBox variant="outline" contentClassName={necessitiesContentClass}>
                  <PrismicRichText
                    field={item.necessities}
                    components={richTextLabelComponents}
                  />
                </InfoBox>
              </>
            ) : null}

            {isFilled.richText(item.footnote) ? (
              <div className="mt-6 text-xs leading-[18px] text-muted-foreground [&_p]:mt-2!">
                <PrismicRichText field={item.footnote} components={richTextLabelComponents} />
              </div>
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
