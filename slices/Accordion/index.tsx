import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronLink } from "@/components/ui/chevron-link";
import { richTextLabelComponents } from "@/lib/rich-text-components";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice>;

export default function Accordion({ slice }: AccordionProps) {
  return (
    <AccordionRoot
      type="multiple"
      defaultValue={slice.items.map((_, index) => `item-${index}`)}
      className="mt-6"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <AccordionItem
          value={`item-${index}`}
          className="border-t! border-b-0! py-1 last:border-b!"
          key={`${item.title}-${index}`}
        >
          <AccordionTrigger className="items-center! gap-3 py-3!">
            <span className="w-5 shrink-0 font-bold text-primary">{index + 1}</span>
            <span className="flex-1 font-bold text-foreground">{item.title}</span>
          </AccordionTrigger>

          <AccordionContent className="pb-2! pl-8! [&_a]:text-primary [&_p]:mb-3 [&_p]:leading-relaxed">
            {item.note ? (
              <div className="mb-4 rounded bg-muted px-5 py-4">
                <p className="m-0 font-bold">{item.note}</p>
              </div>
            ) : null}

            <PrismicRichText field={item.body} components={richTextLabelComponents} />

            {isFilled.richText(item.necessities) ? (
              <>
                {item.necessities_heading ? (
                  <p className="mt-4 mb-2 font-bold">
                    {item.necessities_heading}
                  </p>
                ) : null}
                <div className="mb-4 rounded border px-5 py-4 [&_h4:not(:first-child)]:mt-4 [&_h4]:mb-1 [&_h4]:text-[0.95rem] [&_h4]:font-bold [&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:text-muted-foreground">
                  <PrismicRichText field={item.necessities} components={richTextLabelComponents} />
                </div>
              </>
            ) : null}

            {isFilled.link(item.link) ? (
              <ChevronLink field={item.link}>{item.link_label}</ChevronLink>
            ) : null}

            {isFilled.link(item.link2) ? (
              <ChevronLink field={item.link2}>{item.link2_label}</ChevronLink>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
