import Link from "next/link";
import { Content } from "@prismicio/client";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FaqQuestionListProps =
  SliceComponentProps<Content.FaqQuestionListSlice>;

function ChevronRight({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const headingComponents: JSXMapSerializer = {
  heading2: ({ children }) => (
    <h2 className="flex-1 text-base font-bold">{children}</h2>
  ),
  heading3: ({ children }) => (
    <h3 className="flex-1 text-base font-bold">{children}</h3>
  ),
};

export default function FaqQuestionList({ slice }: FaqQuestionListProps) {
  if (slice.variation === "accordion") {
    return (
      <Accordion
        type="single"
        collapsible
        defaultValue={slice.primary.current ? "category" : undefined}
        className="block border-t py-1 last:border-b"
        data-slice-type={slice.slice_type}
        data-slice-variation={slice.variation}
      >
        <AccordionItem value="category" className="border-b-0">
          <AccordionTrigger className="items-center! gap-3 py-2!">
            <PrismicRichText field={slice.primary.heading} components={headingComponents} />
          </AccordionTrigger>
          <AccordionContent>
            <ul className="mt-3 flex list-none flex-col gap-2 pl-1">
              {slice.items.map((item, index) => (
                <li key={`${item.question}-${index}`}>
                  {item.href ? (
                    <Link href={item.href} className="text-primary no-underline hover:underline">
                      {item.question}
                    </Link>
                  ) : (
                    <span>{item.question}</span>
                  )}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  if (slice.variation === "footer_grid") {
    const links = (
      <ul className="flex list-none flex-col gap-2 p-0">
        {slice.items.map((item, index) => (
          <li key={`${item.question}-${index}`}>
            {item.href ? (
              <Link href={item.href} className="text-primary no-underline hover:underline">
                {item.question}
              </Link>
            ) : (
              <span>{item.question}</span>
            )}
          </li>
        ))}
      </ul>
    );

    return (
      <div
        data-slice-type={slice.slice_type}
        data-slice-variation={slice.variation}
      >
        {/* Desktop/tablet: always-visible title + link list */}
        <div className="hidden sm:block">
          <div className="mb-3 font-bold">
            <PrismicRichText field={slice.primary.heading} components={headingComponents} />
          </div>
          {links}
        </div>

        {/* Mobile: optional section heading (set on the first tile only) + collapsible accordion */}
        <div className="sm:hidden">
          {slice.primary.mobile_section_heading ? (
            <h2 className="mb-2 text-xl font-bold">
              {slice.primary.mobile_section_heading}
            </h2>
          ) : null}
          <Accordion type="single" collapsible className="border-b">
            <AccordionItem value="category" className="border-t border-b-0">
              <AccordionTrigger className="items-center! gap-3 py-3!">
                <PrismicRichText field={slice.primary.heading} components={headingComponents} />
              </AccordionTrigger>
              <AccordionContent>{links}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    );
  }

  if (slice.variation === "grid") {
    return (
      <section
        className="border-b py-5 first-of-type:border-t"
        data-slice-type={slice.slice_type}
        data-slice-variation={slice.variation}
      >
        <div className="mb-3 font-bold">
          <PrismicRichText field={slice.primary.heading} components={headingComponents} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {slice.items.map((item, index) =>
            item.href ? (
              <Link
                key={`${item.question}-${index}`}
                href={item.href}
                className="text-primary underline"
              >
                {item.question}
              </Link>
            ) : (
              <span key={`${item.question}-${index}`}>{item.question}</span>
            ),
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-6"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicRichText field={slice.primary.heading} />
      <PrismicRichText field={slice.primary.description} />
      <ol className="mt-4 list-none p-0">
        {slice.items.map((item, index) => {
          const row = (
            <>
              <span className="flex-1 text-foreground">{item.question}</span>
              <ChevronRight className="shrink-0 text-muted-foreground" />
            </>
          );

          return (
            <li className="border-b" key={`${item.question}-${index}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-4 rounded px-2 py-4 text-inherit no-underline hover:cursor-pointer hover:bg-accent"
                >
                  {row}
                </Link>
              ) : (
                <div className="flex items-center gap-4 px-2 py-4">{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
