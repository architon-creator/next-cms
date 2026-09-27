import type { JSXMapSerializer } from "@prismicio/react";

import { richTextLabelComponents } from "../rich-text-components";

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
 * Numbered lists use Roman numerals when an editor applied the `roman` label to
 * any of their items. Set inline (not via a class) so it beats a panel's own
 * `[&_ol]:list-decimal`.
 */
export const listComponents: JSXMapSerializer = {
  oList: ({ node, children }) => (
    <ol style={hasRomanLabel(node.items) ? { listStyleType: "lower-roman" } : undefined}>
      {children}
    </ol>
  ),
};

/** Serializer for any rich-text field that can contain lists, plus the shared label styles. */
export const listRichTextComponents: JSXMapSerializer = {
  ...richTextLabelComponents,
  ...listComponents,
};
