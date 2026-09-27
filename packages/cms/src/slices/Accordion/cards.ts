import type { RichTextField } from "@prismicio/client";

type RichTextNode = RichTextField[number];

export type CardSegment = { boxed: boolean; nodes: RichTextField };

/**
 * Splits a rich-text field into segments: every `heading4` starts a new
 * boxed card; a `heading5` steps outside the box and starts a plain segment
 * (its own text, if any, still renders — just not boxed), until the next
 * `heading4` opens a box again. Content before the first heading is boxed by
 * default, matching the old behaviour where there was no way to step outside
 * a card. Empty segments are dropped.
 */
export function splitSegments(field: RichTextField): CardSegment[] {
  const segments: { boxed: boolean; nodes: RichTextNode[] }[] = [];
  let boxed = true;

  for (const node of field) {
    if (node.type === "heading4" || node.type === "heading5") {
      boxed = node.type === "heading4";
      segments.push({ boxed, nodes: [] });
    } else if (segments.length === 0) {
      segments.push({ boxed, nodes: [] });
    }

    segments.at(-1)?.nodes.push(node);
  }

  return (segments as CardSegment[]).filter((segment) => segment.nodes.length > 0);
}

/**
 * Values of the items that start expanded. Every item starts collapsed unless
 * the editor ticked `start_expanded`.
 */
export function getOpenValues(items: { start_expanded?: boolean | null }[]): string[] {
  return items.flatMap((item, index) => (item.start_expanded ? [itemValue(index)] : []));
}

export function itemValue(index: number): string {
  return `item-${index}`;
}

/** Inline label an editor applies to a numbered list to make it use Roman numerals (i, ii, iii). */
export const ROMAN_LABEL = "roman";

type LabelledSpan = { type: string; data?: unknown };

/**
 * True when any item of the list carries the `roman` label. Prismic rich text
 * has only bullet and numbered lists, so the style is chosen with this label.
 */
export function hasRomanLabel(items: { spans: readonly LabelledSpan[] }[]): boolean {
  return items.some((item) =>
    item.spans.some(
      (span) =>
        span.type === "label" && (span.data as { label?: string } | undefined)?.label === ROMAN_LABEL,
    ),
  );
}

/**
 * Which card (0-based) holds the download buttons. `requested` is the editor's
 * 1-based `downloads_card`; blank or out of range falls back to the last card.
 */
export function resolveDownloadsIndex(
  requested: number | null | undefined,
  cardCount: number,
): number {
  const last = Math.max(cardCount - 1, 0);

  if (requested == null || !Number.isInteger(requested)) return last;
  if (requested < 1 || requested > cardCount) return last;

  return requested - 1;
}
