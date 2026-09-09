import type { ComponentProps, ReactNode } from "react";
import { PrismicNextLink } from "@prismicio/next";

import { cn } from "../../lib/utils";

type ChevronLinkProps = {
  field: ComponentProps<typeof PrismicNextLink>["field"];
  children: ReactNode;
  /** Trailing "›" + row spacing. Off for a plain inline text link. */
  chevron?: boolean;
  className?: string;
};

/**
 * The trailing "read more"-style link used across Accordion, DisclosureList,
 * and LinkList — `font-semibold text-primary`, optionally with a `›` suffix
 * and row spacing for stacked/list contexts.
 */
export function ChevronLink({
  field,
  children,
  chevron = true,
  className,
}: ChevronLinkProps) {
  return (
    <PrismicNextLink
      field={field}
      className={cn(
        "font-semibold text-primary no-underline hover:underline",
        chevron && "mb-2 flex items-center gap-1 last:mb-0 after:content-['\\203A']",
        className,
      )}
    >
      {children}
    </PrismicNextLink>
  );
}
