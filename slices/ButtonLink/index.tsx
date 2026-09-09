import { Content, isFilled } from "@prismicio/client";
import { PrismicNextLink } from "@prismicio/next";
import { SliceComponentProps } from "@prismicio/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export type ButtonLinkProps = SliceComponentProps<Content.ButtonLinkSlice>;

const icons: Record<string, LucideIcon> = {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Check,
};

const solidClasses = "h-auto! px-8 py-3 font-semibold";
const outlineClasses =
  "h-auto! border-primary! px-8 py-3 font-semibold text-primary! hover:bg-accent!";

export default function ButtonLink({ slice }: ButtonLinkProps) {
  if (!isFilled.link(slice.primary.link)) return null;

  const isSolid = slice.primary.style === "Solid";
  const IconLeft = icons[slice.primary.icon_left ?? ""];
  const IconRight = icons[slice.primary.icon_right ?? ""];

  return (
    <div
      className="my-8 flex justify-center"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <Button
        asChild
        variant={isSolid ? "default" : "outline"}
        className={isSolid ? solidClasses : outlineClasses}
      >
        <PrismicNextLink field={slice.primary.link}>
          {IconLeft ? <IconLeft data-icon="inline-start" /> : null}
          {slice.primary.label}
          {IconRight ? <IconRight data-icon="inline-end" /> : null}
        </PrismicNextLink>
      </Button>
    </div>
  );
}
