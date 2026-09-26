import type { ReactNode } from "react";

import { Card, CardContent } from "ui";
import { cn } from "../../lib/utils";

type InfoBoxProps = {
  /** `fill`: grey surface (notes, cards). `outline`: white with a border (necessities). */
  variant?: "fill" | "outline";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

const variants = {
  fill: "bg-surface-muted",
  outline: "border bg-transparent",
} as const;

/**
 * The flat, square-cornered box used throughout the Accordion — `Card` from
 * `ui` with the source design's 28px / 32px padding. One place to change it.
 */
export function InfoBox({
  variant = "fill",
  className,
  contentClassName,
  children,
}: InfoBoxProps) {
  return (
    <Card className={cn("gap-0 rounded py-7 ring-0", variants[variant], className)}>
      <CardContent className={cn("px-8", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
