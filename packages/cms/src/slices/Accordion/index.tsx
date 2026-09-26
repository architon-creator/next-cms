import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  ChevronLink,
} from "ui";
import { richTextLabelComponents } from "../../lib/rich-text-components";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice>;

export default function Accordion({ slice }: AccordionProps) {
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
          <AccordionTrigger className="items-center! gap-3 py-5! text-base">
            <span className="w-5 shrink-0 font-bold text-primary">{index + 1}</span>
            <span className="flex-1 font-bold text-foreground">{item.title}</span>
          </AccordionTrigger>

          <AccordionContent className="pt-[7px]! pb-12! text-base text-[#100D0D] [&_a]:text-primary [&_p]:mt-4 [&_p]:mb-0 [&_p]:leading-6">
            {item.note ? (
              <Card className="mb-[29px] gap-0 rounded bg-[#F4F7F6] py-7 ring-0">
                <CardContent className="px-8">
                  <p className="m-0! font-bold leading-6">{item.note}</p>
                </CardContent>
              </Card>
            ) : null}

            <PrismicRichText field={item.body} components={richTextLabelComponents} />

            {isFilled.richText(item.necessities) ? (
              <>
                {item.necessities_heading ? (
                  <p className="mt-11! mb-3! text-xs leading-[18px]! font-bold">{item.necessities_heading}</p>
                ) : null}
                <Card className="mb-0 gap-0 rounded border bg-transparent py-7 ring-0">
                  <CardContent className="px-8 [&_h4:not(:first-child)]:mt-[26px] [&_h4]:mb-1 [&_h4]:text-[1.05rem] [&_h4]:leading-6 [&_h4]:font-bold [&_p]:m-0! [&_p]:text-xs [&_p]:leading-[18px]! [&_p]:text-foreground">
                    <PrismicRichText
                      field={item.necessities}
                      components={richTextLabelComponents}
                    />
                  </CardContent>
                </Card>
              </>
            ) : null}

            {isFilled.link(item.link) ? (
              <ChevronLink field={item.link} className="mb-0 pt-5">{item.link_label}</ChevronLink>
            ) : null}

            {isFilled.link(item.link2) ? (
              <ChevronLink field={item.link2} className="mb-0 pt-5">{item.link2_label}</ChevronLink>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
