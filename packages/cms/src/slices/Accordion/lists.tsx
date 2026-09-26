import type { JSXMapSerializer } from "@prismicio/react";

import { richTextLabelComponents } from "../../lib/rich-text-components";
import { hasRomanLabel } from "./cards";

/**
 * Numbered lists use Roman numerals when an editor applied the `roman` label to
 * any of their items. Set inline (not via a class) so it beats the panel's
 * `[&_ol]:list-decimal`.
 */
export const listComponents: JSXMapSerializer = {
  oList: ({ node, children }) => (
    <ol style={hasRomanLabel(node.items) ? { listStyleType: "lower-roman" } : undefined}>
      {children}
    </ol>
  ),
};

/** Serializer for the Accordion's rich-text fields that can contain lists. */
export const listRichTextComponents: JSXMapSerializer = {
  ...richTextLabelComponents,
  ...listComponents,
};
