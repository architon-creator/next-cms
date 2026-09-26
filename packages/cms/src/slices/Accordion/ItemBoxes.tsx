import { isFilled } from "@prismicio/client";
import type { RichTextField } from "@prismicio/client";
import { PrismicNextImage } from "@prismicio/next";
import { JSXMapSerializer, PrismicRichText } from "@prismicio/react";

import { richTextLabelComponents } from "../../lib/rich-text-components";
import { resolveDownloadsIndex, splitCards } from "./cards";
import { Downloads, hasDownloads } from "./Downloads";
import { InfoBox } from "./InfoBox";
import { cardContentClass } from "./styles";
import type { AccordionItem } from "./types";

const cardComponents: JSXMapSerializer = {
  ...richTextLabelComponents,
  image: ({ node }) => <PrismicNextImage field={node} className="mt-4 h-auto max-w-full" />,
};

type ItemBoxesProps = {
  item: AccordionItem;
  fileSizeLabel: string;
};

/**
 * The item's grey cards (from `cards`). The download buttons sit inside the
 * card chosen by `downloads_card`, or in a card of their own if there are none.
 */
export function ItemBoxes({ item, fileSizeLabel }: ItemBoxesProps) {
  const cards = isFilled.richText(item.cards) ? splitCards(item.cards) : [];
  const downloads = hasDownloads(item);
  if (cards.length === 0 && !downloads) return null;

  const boxes: (RichTextField | null)[] = cards.length > 0 ? cards : [null];
  const downloadsIndex = resolveDownloadsIndex(item.downloads_card, boxes.length);

  return boxes.map((card, index) => (
    <InfoBox className="mt-4" contentClassName={cardContentClass} key={index}>
      {card ? <PrismicRichText field={card} components={cardComponents} /> : null}
      {downloads && index === downloadsIndex ? (
        <Downloads item={item} spaced={card !== null} fileSizeLabel={fileSizeLabel} />
      ) : null}
    </InfoBox>
  ));
}
