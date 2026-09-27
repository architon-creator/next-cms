import { isFilled } from "@prismicio/client";
import { PrismicNextImage } from "@prismicio/next";
import { JSXMapSerializer, PrismicRichText } from "@prismicio/react";

import { resolveDownloadsIndex, splitSegments } from "./cards";
import { Downloads, hasDownloads } from "./Downloads";
import { InfoBox } from "./InfoBox";
import { listRichTextComponents } from "./lists";
import { cardContentClass } from "./styles";
import type { AccordionItem } from "./types";

const cardComponents: JSXMapSerializer = {
  ...listRichTextComponents,
  image: ({ node }) => <PrismicNextImage field={node} className="mt-4 h-auto max-w-full" />,
  // heading5 is the "step outside the box" marker (see splitSegments) — if the
  // editor gave it text, show it as a plain (unboxed) sub-heading.
  heading5: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
};

type ItemBoxesProps = {
  item: AccordionItem;
  fileSizeLabel: string;
};

/**
 * The item's `cards` field, split into boxed cards and plain (unboxed)
 * segments — an editor inserts a Heading 5 in the rich text to step outside a
 * card; the next Heading 4 opens a new box. The download buttons sit inside
 * the boxed card chosen by `downloads_card` (position among the *boxed* cards
 * only; unboxed segments don't count), or in a card of their own if there are
 * no boxed cards at all.
 */
export function ItemBoxes({ item, fileSizeLabel }: ItemBoxesProps) {
  const segments = isFilled.richText(item.cards) ? splitSegments(item.cards) : [];
  const downloads = hasDownloads(item);
  if (segments.length === 0 && !downloads) return null;

  const boxedCount = segments.filter((segment) => segment.boxed).length;
  const downloadsIndex = resolveDownloadsIndex(item.downloads_card, Math.max(boxedCount, 1));
  // With no boxed cards, the downloads get a card of their own at the end.
  const ownDownloadsCard = boxedCount === 0 && downloads;

  let boxedSeen = -1;

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.boxed) boxedSeen += 1;
        const showDownloadsHere = downloads && segment.boxed && boxedSeen === downloadsIndex;
        const content = (
          <PrismicRichText field={segment.nodes} components={cardComponents} />
        );

        if (!segment.boxed) {
          return (
            <div className="mt-4 [&>:first-child]:mt-0!" key={index}>
              {content}
            </div>
          );
        }

        return (
          <InfoBox className="mt-4" contentClassName={cardContentClass} key={index}>
            {content}
            {showDownloadsHere ? (
              <Downloads item={item} spaced fileSizeLabel={fileSizeLabel} />
            ) : null}
          </InfoBox>
        );
      })}

      {ownDownloadsCard ? (
        <InfoBox className="mt-4" contentClassName={cardContentClass}>
          <Downloads item={item} spaced={false} fileSizeLabel={fileSizeLabel} />
        </InfoBox>
      ) : null}
    </>
  );
}
