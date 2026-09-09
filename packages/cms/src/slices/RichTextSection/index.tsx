import { Content } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { cn } from "../../lib/utils";
import { richTextLabelComponents } from "../../lib/rich-text-components";

export type RichTextSectionProps = SliceComponentProps<Content.RichTextSectionSlice>;

const sizeClasses: Record<string, string> = {
  Small: "text-sm",
  Medium: "text-base",
  Large: "text-lg",
};

const colorClasses: Record<string, string> = {
  Default: "text-foreground",
  Muted: "text-muted-foreground",
  Accent: "text-primary",
};

export default function RichTextSection({ slice }: RichTextSectionProps) {
  const fontSize = slice.primary.font_size || "Medium";
  const fontColor = slice.primary.font_color || "Default";

  return (
    <section
      className={cn(
        "mt-8 [&_a]:text-primary [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mb-3 [&_p]:leading-relaxed",
        sizeClasses[fontSize],
        colorClasses[fontColor],
      )}
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicRichText
        field={slice.primary.heading}
        components={richTextLabelComponents}
      />
      <PrismicRichText field={slice.primary.body} components={richTextLabelComponents} />

      {slice.items.map((item, index) => {
        const itemFontSize = item.font_size || "Medium";
        const itemFontColor = item.font_color || "Default";

        return (
          <div
            className={cn(
              "mb-2 leading-relaxed",
              sizeClasses[itemFontSize],
              colorClasses[itemFontColor],
            )}
            key={index}
          >
            <PrismicRichText field={item.text} components={richTextLabelComponents} />
          </div>
        );
      })}
    </section>
  );
}
