import type { RichTextField } from "@prismicio/client";

type RichTextNode = RichTextField[number];

/**
 * Splits a rich-text field into cards: every `heading4` starts a new card.
 * Content before the first `heading4` forms a heading-less card of its own.
 */
export function splitCards(field: RichTextField): RichTextField[] {
  const groups: RichTextNode[][] = [];

  for (const node of field) {
    if (node.type === "heading4" || groups.length === 0) groups.push([]);
    groups.at(-1)?.push(node);
  }

  return groups as RichTextField[];
}

/**
 * Values of the items that start open. An item is open unless the editor ticked
 * `start_collapsed` — so content that predates the field stays fully open.
 */
export function getOpenValues(items: { start_collapsed?: boolean | null }[]): string[] {
  return items.flatMap((item, index) => (item.start_collapsed ? [] : [itemValue(index)]));
}

export function itemValue(index: number): string {
  return `item-${index}`;
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
