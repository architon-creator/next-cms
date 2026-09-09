import { Content, isFilled } from "@prismicio/client";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { ChevronLink } from "@/components/ui/chevron-link";

export type LinkListProps = SliceComponentProps<Content.LinkListSlice>;

const headingComponents: JSXMapSerializer = {
  heading2: ({ children }) => (
    <h2 className="mb-3 text-xl font-semibold">{children}</h2>
  ),
  heading3: ({ children }) => (
    <h3 className="mb-3 text-xl font-semibold">{children}</h3>
  ),
};

export default function LinkList({ slice }: LinkListProps) {
  return (
    <div
      className="mt-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {isFilled.richText(slice.primary.heading) ? (
        <PrismicRichText field={slice.primary.heading} components={headingComponents} />
      ) : null}

      {slice.items.map((item, index) =>
        isFilled.link(item.link) ? (
          <ChevronLink key={`${item.label}-${index}`} field={item.link}>
            {item.label}
          </ChevronLink>
        ) : null,
      )}
    </div>
  );
}
