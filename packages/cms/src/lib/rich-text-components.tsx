import { JSXMapSerializer } from "@prismicio/react";

const labelClasses: Record<string, string> = {
  underline: "underline",
  small: "text-[0.875em]",
  large: "text-[1.125em]",
  muted: "text-muted-foreground",
  accent: "text-primary",
  highlight: "rounded-sm bg-[#fff3b0] px-0.5 py-px",
};

/**
 * Maps Prismic's inline toolbar `label` spans (muted/small/large/accent/
 * highlight/underline) to Tailwind classes. Pass as `components` to any
 * `PrismicRichText` whose field's model has a `labels` config.
 */
export const richTextLabelComponents: JSXMapSerializer = {
  label: ({ node, children }) => (
    <span className={labelClasses[node.data.label] ?? ""}>{children}</span>
  ),
};
