"use client";

import { useState } from "react";
import { Content } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FaqAnswerSwapProps = SliceComponentProps<Content.FaqAnswerSwapSlice>;

export default function FaqAnswerSwap({ slice }: FaqAnswerSwapProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = slice.items;
  const active = items[activeIndex];

  if (!active) return null;

  return (
    <div
      className="mt-6 flex flex-col gap-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{active.question}</CardTitle>
        </CardHeader>
        <CardContent className="[&_a]:text-primary [&_p]:mb-3 [&_p]:leading-relaxed">
          <PrismicRichText field={active.answer} />
        </CardContent>
      </Card>

      {items.length > 1 ? (
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle className="text-base">
              {slice.primary.related_heading || "Related question"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex list-none flex-col gap-2 p-0">
              {items.map((item, index) =>
                index === activeIndex ? null : (
                  <li key={`${item.question}-${index}`}>
                    <button
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className="w-full rounded px-2 py-2 text-left font-semibold text-primary hover:bg-accent hover:underline"
                    >
                      {item.question}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
