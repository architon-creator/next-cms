import { Content } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type InfoCardListProps = SliceComponentProps<Content.InfoCardListSlice>;

export default function InfoCardList({ slice }: InfoCardListProps) {
  return (
    <div
      className="mt-6 flex flex-col gap-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <Card className="bg-muted" key={`${item.title}-${index}`}>
          {item.title ? (
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent className="[&_ol]:mb-2 [&_ol]:pl-5 [&_ol]:leading-relaxed [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:pl-5 [&_ul]:leading-relaxed">
            <PrismicRichText field={item.body} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
