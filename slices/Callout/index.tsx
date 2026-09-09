import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CalloutProps = SliceComponentProps<Content.CalloutSlice>;

const styleClasses: Record<string, string> = {
  Neutral: "bg-muted border-border",
  Info: "bg-[#eaf6f3] border-primary",
  Warning: "bg-[#fff8e6] border-[#e0a300]",
  Success: "bg-[#eaf8ee] border-[#2e9e4f]",
};

export default function Callout({ slice }: CalloutProps) {
  const style = slice.primary.style || "Neutral";

  return (
    <Card
      className={cn("my-8", styleClasses[style])}
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {isFilled.richText(slice.primary.heading) ? (
        <CardHeader>
          <CardTitle className="text-[1.05rem]">
            <PrismicRichText field={slice.primary.heading} />
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="[&_p:last-child]:mb-0 [&_p]:mb-2 [&_p]:leading-relaxed">
        <PrismicRichText field={slice.primary.body} />
      </CardContent>
    </Card>
  );
}
