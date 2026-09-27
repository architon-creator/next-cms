import { isFilled } from "@prismicio/client";
import { PrismicNextImage, PrismicNextLink } from "@prismicio/next";
import { PrismicRichText } from "@prismicio/react";

import { Button, ChevronLink } from "ui";
import { InfoBox } from "./InfoBox";
import { listRichTextComponents } from "./lists";
import { cardContentClass } from "./styles";
import type { BlockItem } from "./types";

type BlocksProps = {
  blocks: readonly BlockItem[];
};

/**
 * Renders a `blocks` Group: a free-form, freely-ordered, freely-repeatable
 * stream of content, shared by every slice that has one (Accordion's
 * `with_cards` variation, `FlexibleContent`, …). Each Group item is one
 * block; the editor fills in only the fields for whichever type that block
 * is (a block can combine more than one — text + an image, say — which
 * renders in the fixed order below). Reordering blocks in Prismic reorders
 * the page; there is no marker convention to learn.
 */
export function Blocks({ blocks }: BlocksProps) {
  return (
    <>
      {blocks.map((block, index) => (
        <div className="mt-4 first:mt-0" key={index}>
          {isFilled.richText(block.text) ? (
            <PrismicRichText field={block.text} components={listRichTextComponents} />
          ) : null}

          {isFilled.image(block.image) ? (
            <PrismicNextImage field={block.image} className="h-auto max-w-full" />
          ) : null}

          {block.card_heading || isFilled.richText(block.card_body) ? (
            <InfoBox contentClassName={cardContentClass}>
              {block.card_heading ? (
                <p className="mb-3! text-lg leading-6 font-normal">{block.card_heading}</p>
              ) : null}
              <PrismicRichText field={block.card_body} components={listRichTextComponents} />
            </InfoBox>
          ) : null}

          {isFilled.link(block.link) ? (
            <ChevronLink field={block.link} className="mb-0 w-fit">
              {block.link_label}
            </ChevronLink>
          ) : null}

          {block.button_label ? (
            <div className="max-w-80">
              {isFilled.link(block.button_link) ? (
                <Button
                  asChild
                  variant="outline"
                  className="h-auto! w-full border-primary! bg-white px-6 py-3 font-semibold text-primary! hover:bg-accent!"
                >
                  <PrismicNextLink field={block.button_link}>{block.button_label}</PrismicNextLink>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  className="h-auto! w-full border-border! px-6 py-3 font-semibold text-muted-foreground! opacity-100!"
                >
                  {block.button_label}
                </Button>
              )}
              {block.button_caption ? (
                <p className="mt-1.5! text-xs text-muted-foreground">{block.button_caption}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
