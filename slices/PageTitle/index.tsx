import { Content } from "@prismicio/client";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

export type PageTitleProps = SliceComponentProps<Content.PageTitleSlice>;

const components: JSXMapSerializer = {
  heading1: ({ children }) => (
    <h1 className="mb-2 text-4xl font-semibold">{children}</h1>
  ),
};

export default function PageTitle({ slice }: PageTitleProps) {
  return (
    <section
      className="mt-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicRichText field={slice.primary.title} components={components} />
      {slice.primary.subtitle ? (
        <p className="text-muted-foreground">{slice.primary.subtitle}</p>
      ) : null}
    </section>
  );
}
