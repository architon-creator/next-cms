import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";
import type { ReactNode } from "react";

import {
  Accordion as AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ChevronLink,
} from "ui";
import { InfoBox } from "../../lib/content-blocks/InfoBox";
import { listRichTextComponents } from "../../lib/content-blocks/lists";
import { splitRows } from "../../lib/content-blocks/rows";
import { richTextLabelComponents } from "../../lib/rich-text-components";
import { definitionRowsClass } from "../../lib/content-blocks/styles";
import { contentClass, iconClass, titleClass, triggerClass } from "../Accordion/styles";

export type BoardingProcessStepProps = SliceComponentProps<Content.BoardingProcessStepSlice>;

type BlockItem = Content.BoardingProcessStepSliceDefaultPrimaryContentBlocksItem;

/** Layout wrapper per `block_type` — the rich text itself always renders via `PrismicRichText`. */
const layoutByBlockType: Partial<Record<string, (children: ReactNode) => ReactNode>> = {
  subheading: (children) => (
    <div className="font-bold text-ink text-lg leading-7">{children}</div>
  ),
  section_heading: (children) => (
    <div className="font-bold text-primary text-xl leading-8">{children}</div>
  ),
  callout: (children) => (
    <InfoBox className="mt-4" contentClassName="font-bold text-base leading-6">
      {children}
    </InfoBox>
  ),
  note: (children) => <div className="text-muted-foreground text-sm leading-5">{children}</div>,
  link_note: (children) => <div className="text-base text-ink leading-6">{children}</div>,
};

/**
 * `info_card` blocks split their `content` on every `heading4` into one
 * card per heading — each section gets its own boxed `InfoBox`, matching
 * how the source design renders multiple distinct card boxes back to back
 * (not one shared box with internal sections). Uses the same `splitRows`
 * as `SpecBoxList`'s `rows` field — content before the first `heading4`
 * gets an empty `label` rather than being dropped.
 */
function InfoCards({ content }: { content: BlockItem["content"] }) {
  const cards = splitRows(content);

  return (
    <>
      {cards.map((card, index) => (
        <InfoBox key={index} className="mt-4" contentClassName="flex flex-col gap-2">
          {card.label ? <p className="font-bold text-ink text-lg leading-7">{card.label}</p> : null}
          <PrismicRichText field={card.value} components={richTextLabelComponents} />
        </InfoBox>
      ))}
    </>
  );
}

function ContentBlock({ item }: { item: BlockItem }) {
  if (item.block_type === "button") {
    return isFilled.link(item.button_link) ? (
      <ChevronLink field={item.button_link} className="mt-4 mb-0 w-fit">
        {item.button_label}
      </ChevronLink>
    ) : null;
  }

  if (item.block_type === "info_card") {
    return isFilled.richText(item.content) ? <InfoCards content={item.content} /> : null;
  }

  const richText = (
    <PrismicRichText field={item.content} components={listRichTextComponents} />
  );
  const wrap = layoutByBlockType[item.block_type ?? ""];
  return wrap ? wrap(richText) : richText;
}

function StepContent({ blocks }: { blocks: readonly BlockItem[] }) {
  return (
    <>
      {blocks.map((item, index) => (
        <div key={index}>
          <ContentBlock item={item} />
        </div>
      ))}
    </>
  );
}

/**
 * A numbered boarding-process step with a free-form, drag-ordered content
 * stream (`content_blocks`, discriminated by `block_type`) instead of the
 * fixed `body`/`blocks` fields Accordion's variations use. `note`,
 * `necessities`, `footnote` and the trailing links stay as dedicated
 * `primary` fields — only the genuinely unpredictable part of a step lives
 * in `content_blocks`.
 *
 * `content_blocks` is a `Group` on `primary` rather than the slice's native
 * `items` zone; ordering works the same either way — array position is the
 * render order.
 *
 * `display_mode` toggles between a collapsible accordion panel and a plain
 * always-visible section, replacing what Accordion needs two slice
 * variations (`default`/`with_cards`) to express.
 */
export default function BoardingProcessStep({ slice }: BoardingProcessStepProps) {
  const {
    step_number,
    step_title,
    display_mode,
    start_expanded,
    note,
    necessities_heading,
    necessities,
    footnote,
    link,
    link2,
    link_label,
    link2_label,
    content_blocks,
  } = slice.primary;

  const heading = `${step_number ?? ""} ${step_title ?? ""}`.trim();

  const body = (
    <>
      {note ? (
        <InfoBox className="mb-[29px]">
          <p className="m-0! font-bold leading-6">{note}</p>
        </InfoBox>
      ) : null}

      <StepContent blocks={content_blocks} />

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
    </>
  );

  return (
    <section
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
      className="pt-[26px] [&+&]:pt-0 [&+&]:-mt-px"
    >
      {display_mode === "static" ? (
        <>
          <p className={titleClass}>{heading}</p>
          <div className={contentClass}>{body}</div>
        </>
      ) : (
        <AccordionRoot type="multiple" defaultValue={start_expanded ? ["step"] : []}>
          <AccordionItem value="step" className="border-t! border-b! last:border-b!">
            <AccordionTrigger className={triggerClass}>
              <span className={titleClass}>{heading}</span>
              <span aria-hidden="true" className={iconClass}>
                expand_circle_down
              </span>
            </AccordionTrigger>
            <AccordionContent className={contentClass}>{body}</AccordionContent>
          </AccordionItem>
        </AccordionRoot>
      )}
    </section>
  );
}
