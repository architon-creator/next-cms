import { Content, isFilled } from "@prismicio/client";
import { PrismicNextLink } from "@prismicio/next";
import { SliceComponentProps } from "@prismicio/react";

import { Button } from "../../components/ui/button";

export type FileDownloadListProps = SliceComponentProps<Content.FileDownloadListSlice>;

export default function FileDownloadList({ slice }: FileDownloadListProps) {
  return (
    <div
      className="my-6 flex max-w-80 flex-col gap-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {isFilled.link(item.file) ? (
            <Button
              asChild
              variant="outline"
              className="h-auto! w-full border-primary! px-6 py-3 font-semibold text-primary! hover:bg-accent!"
            >
              <PrismicNextLink field={item.file}>{item.label}</PrismicNextLink>
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled
              className="h-auto! w-full border-border! px-6 py-3 font-semibold text-muted-foreground! opacity-100!"
            >
              {item.label}
            </Button>
          )}
          {item.file_size ? (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              File Size: {item.file_size}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
