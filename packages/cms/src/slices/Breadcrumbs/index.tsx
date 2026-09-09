import { Content } from "@prismicio/client";
import { SliceComponentProps } from "@prismicio/react";

import { PageContext } from "../types";

export type BreadcrumbsProps = SliceComponentProps<
  Content.BreadcrumbsSlice,
  PageContext
>;

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ChevronSeparator() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-muted-foreground"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function Breadcrumbs({ slice, context }: BreadcrumbsProps) {
  const crumbs = (context?.breadcrumbs ?? []).filter((crumb) => crumb.label);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <ol className="m-0 flex list-none items-center gap-1.5 p-0">
        <li className="flex items-center gap-1.5">
          <a
            href="/"
            className="inline-flex text-primary"
            aria-label="Home"
          >
            <HomeIcon />
          </a>
          <ChevronSeparator />
        </li>
        {crumbs.map((crumb, index) => (
          <li className="flex items-center gap-1.5" key={`${crumb.label}-${index}`}>
            {crumb.href ? (
              <a
                href={crumb.href}
                className="text-muted-foreground no-underline hover:text-primary"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="text-foreground">{crumb.label}</span>
            )}
            {index < crumbs.length - 1 ? <ChevronSeparator /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
