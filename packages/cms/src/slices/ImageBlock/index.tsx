import { Content, isFilled } from "@prismicio/client";
import { PrismicNextImage } from "@prismicio/next";
import { SliceComponentProps } from "@prismicio/react";

export type ImageBlockProps = SliceComponentProps<Content.ImageBlockSlice>;

export default function ImageBlock({ slice }: ImageBlockProps) {
  if (!isFilled.image(slice.primary.image)) return null;

  return (
    <figure
      className="my-8"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicNextImage
        field={slice.primary.image}
        className="h-auto w-full rounded-md"
      />
      {slice.primary.caption ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {slice.primary.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
