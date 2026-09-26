import { Content, isFilled } from "@prismicio/client";
import type { RichTextField } from "@prismicio/client";
import { PrismicNextImage, PrismicNextLink } from "@prismicio/next";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  CardContent,
  ChevronLink,
} from "ui";
import { richTextLabelComponents } from "../../lib/rich-text-components";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice>;

const cardComponents: JSXMapSerializer = {
  ...richTextLabelComponents,
  image: ({ node }) => (
    <PrismicNextImage field={node} className="mt-4 h-auto max-w-full" />
  ),
};

/** Splits a rich-text field into cards: every `heading4` starts a new card. */
function splitCards(field: RichTextField): RichTextField[] {
  const cards: RichTextField[] = [];
  for (const node of field) {
    if (node.type === "heading4" || cards.length === 0) cards.push([]);
    (cards[cards.length - 1] as RichTextField).push(node as never);
  }
  return cards;
}

const files = [1, 2, 3] as const;

type AccordionItem = Content.AccordionSlice["items"][number];

const cardContentClass =
  "px-8 [&>:first-child]:mt-0! [&_h4]:mb-3 [&_h4]:text-lg [&_h4]:leading-6 [&_h4]:font-normal [&_p]:text-xs [&_p]:leading-[18px] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-xs [&_ul]:leading-[18px] [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-xs [&_ol]:leading-[18px]";

function hasDownloads(item: AccordionItem) {
  return files.some((n) => item[`file_${n}_label`] || item[`file_${n}_heading`]);
}

function Downloads({ item, spaced }: { item: AccordionItem; spaced: boolean }) {
  return (
    <div className={spaced ? "mt-6" : undefined}>
      {files.map((n) => {
        const label = item[`file_${n}_label`];
        const file = item[`file_${n}`];
        const heading = item[`file_${n}_heading`];
        const size = item[`file_${n}_size`];
        if (!label && !heading) return null;

        return (
          <div className="mt-6 first:mt-0" key={n}>
            {heading ? <p className="m-0! font-bold">{heading}</p> : null}
            {label ? (
              <div className={heading ? "mt-3 max-w-80" : "max-w-80"}>
                {isFilled.link(file) ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto! w-full border-primary! bg-white px-6 py-3 font-semibold text-primary! hover:bg-accent!"
                  >
                    <PrismicNextLink field={file}>{label}</PrismicNextLink>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="h-auto! w-full border-border! px-6 py-3 font-semibold text-muted-foreground! opacity-100!"
                  >
                    {label}
                  </Button>
                )}
                {size ? (
                  <p className="mt-1.5! text-xs text-muted-foreground">
                    File Size: {size}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Grey cards (from `cards`); the download buttons sit inside the last card, or in a card of their own. */
function ItemBoxes({ item }: { item: AccordionItem }) {
  const cards = isFilled.richText(item.cards) ? splitCards(item.cards) : [];
  const downloads = hasDownloads(item);
  if (cards.length === 0 && !downloads) return null;

  const boxes: (RichTextField | null)[] = cards.length > 0 ? cards : [null];
  // 1-based card that holds the downloads; blank/out of range = the last card.
  const requested = item.downloads_card ?? boxes.length;
  const downloadsIndex = requested >= 1 && requested <= boxes.length ? requested - 1 : boxes.length - 1;

  return boxes.map((card, index) => (
    <Card className="mt-4 gap-0 rounded bg-[#F4F7F6] py-7 ring-0" key={index}>
      <CardContent className={cardContentClass}>
        {card ? <PrismicRichText field={card} components={cardComponents} /> : null}
        {downloads && index === downloadsIndex ? (
          <Downloads item={item} spaced={card !== null} />
        ) : null}
      </CardContent>
    </Card>
  ));
}

export default function Accordion({ slice }: AccordionProps) {
  const showNumber = !slice.primary.hide_number;

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
          <AccordionTrigger className="cursor-pointer items-center! gap-2.5 py-5! text-base hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden!">
            {showNumber ? (
              <span className="shrink-0 font-bold text-primary">{index + 1}</span>
            ) : null}
            <span className="flex-1 font-bold text-[#100D0D] group-hover/accordion-trigger:text-primary group-hover/accordion-trigger:underline">
              {item.title}
            </span>
            {/* Replaces the shared trigger's default chevrons (hidden above) — other apps keep those. */}
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none shrink-0 leading-none text-primary transition-transform group-aria-expanded/accordion-trigger:rotate-180"
            >
              expand_circle_down
            </span>
          </AccordionTrigger>

          <AccordionContent className="pt-[7px]! pb-12! text-base text-[#100D0D] [&_a]:text-primary [&_a]:no-underline [&_a]:hover:text-primary [&_a]:hover:underline [&_p]:mt-4 [&_p]:mb-0 [&_p]:leading-6">
            {item.note ? (
              <Card className="mb-[29px] gap-0 rounded bg-[#F4F7F6] py-7 ring-0">
                <CardContent className="px-8">
                  <p className="m-0! font-bold leading-6">{item.note}</p>
                </CardContent>
              </Card>
            ) : null}

            <PrismicRichText field={item.body} components={richTextLabelComponents} />

            <ItemBoxes item={item} />

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

            {isFilled.richText(item.footnote) ? (
              <div className="mt-6 text-xs leading-[18px] text-muted-foreground [&_p]:mt-2!">
                <PrismicRichText field={item.footnote} components={richTextLabelComponents} />
              </div>
            ) : null}

            {isFilled.link(item.link) ? (
              <ChevronLink field={item.link} className="mb-0 w-fit pt-2">{item.link_label}</ChevronLink>
            ) : null}

            {isFilled.link(item.link2) ? (
              <ChevronLink field={item.link2} className="mb-0 w-fit pt-2">{item.link2_label}</ChevronLink>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
