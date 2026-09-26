import { isFilled } from "@prismicio/client";
import { PrismicNextLink } from "@prismicio/next";

import { Button } from "ui";
import type { AccordionItem } from "./types";

/** Download slots per item (flat fields: Prismic can't nest a Group in `items`). */
const SLOTS = [1, 2, 3] as const;

export function hasDownloads(item: AccordionItem) {
  return SLOTS.some((n) => item[`file_${n}_label`] || item[`file_${n}_heading`]);
}

type DownloadsProps = {
  item: AccordionItem;
  /** Add top spacing (when it follows card text rather than starting the card). */
  spaced: boolean;
  fileSizeLabel: string;
};

/** Optional sub-heading, outline download button and "File Size: …" caption, per slot. */
export function Downloads({ item, spaced, fileSizeLabel }: DownloadsProps) {
  return (
    <div className={spaced ? "mt-6" : undefined}>
      {SLOTS.map((n) => {
        const label = item[`file_${n}_label`];
        const file = item[`file_${n}`];
        const heading = item[`file_${n}_heading`];
        const size = item[`file_${n}_size`];
        if (!label && !heading) return null;

        return (
          <div className="mt-6 first:mt-0" key={n}>
            {heading ? <p className="m-0! font-bold">{heading}</p> : null}
            {label ? (
              <div className={heading ? "mt-3 max-w-80" : "max-w-80"}>
                {isFilled.link(file) ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto! w-full border-primary! bg-white px-6 py-3 font-semibold text-primary! hover:bg-accent!"
                  >
                    <PrismicNextLink field={file}>{label}</PrismicNextLink>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="h-auto! w-full border-border! px-6 py-3 font-semibold text-muted-foreground! opacity-100!"
                  >
                    {label}
                  </Button>
                )}
                {size ? (
                  <p className="mt-1.5! text-xs text-muted-foreground">
                    {fileSizeLabel}: {size}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
