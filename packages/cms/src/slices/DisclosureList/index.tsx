import { Content, isFilled } from "@prismicio/client";
import { PrismicNextLink } from "@prismicio/next";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ChevronLink,
} from "ui";
import { cn } from "../../lib/utils";

export type DisclosureListProps = SliceComponentProps<Content.DisclosureListSlice>;

export default function DisclosureList({ slice }: DisclosureListProps) {
  const { title, body, box_heading, box_body, files, link_label, link } = slice.primary;

  const hasBox = isFilled.richText(box_body);
  const hasFiles = files.length > 0;

  return (
    <Accordion
      type="multiple"
      defaultValue={["item"]}
      className="mt-6"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <AccordionItem value="item" className="border-t! border-b-0! py-1 last:border-b!">
        <AccordionTrigger className="items-center! gap-3 py-3!">
          <span className="flex-1 font-bold text-foreground">{title}</span>
        </AccordionTrigger>

        <AccordionContent className="pb-2! [&_a]:text-primary [&_p]:mb-3 [&_p]:leading-relaxed">
          <PrismicRichText field={body} />

          {hasBox ? (
            <div
              className={cn(
                "max-w-xl bg-muted px-5 pt-4 pb-4 [&_p]:text-[0.9rem] [&_p]:leading-relaxed",
                hasFiles ? "rounded-t-md" : "rounded-md",
                !hasFiles && isFilled.link(link) && "mb-4",
              )}
            >
              {box_heading ? (
                <h4 className="mb-2 text-[0.95rem] font-bold">{box_heading}</h4>
              ) : null}
              <PrismicRichText field={box_body} />
            </div>
          ) : null}

          {hasFiles ? (
            <div
              className={cn(
                "flex max-w-xl flex-col gap-4 bg-muted px-5 pb-4",
                hasBox ? "rounded-b-md pt-2" : "rounded-md pt-4",
                isFilled.link(link) && "mb-4",
              )}
            >
              {files.map((file, index) => (
                <div className="max-w-80" key={`${file.label}-${index}`}>
                  {isFilled.link(file.file) ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-auto! w-full border-primary! px-6 py-3 font-semibold text-primary! hover:bg-accent!"
                    >
                      <PrismicNextLink field={file.file}>{file.label}</PrismicNextLink>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled
                      className="h-auto! w-full border-border! px-6 py-3 font-semibold text-muted-foreground! opacity-100!"
                    >
                      {file.label}
                    </Button>
                  )}
                  {file.file_size ? (
                    <p className="mt-1.5 text-center text-xs text-muted-foreground">
                      File Size: {file.file_size}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {isFilled.link(link) ? (
            <ChevronLink field={link} chevron={false}>
              {link_label}
            </ChevronLink>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
