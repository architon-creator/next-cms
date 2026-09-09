"use client";

import type { Content } from "@prismicio/client";
import { PrismicRichText, type SliceComponentProps } from "@prismicio/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import { usePathname, useRouter } from "next/navigation";
import type { FC } from "react";
import { useFaqTopic } from "../../lib/faq-topic-context";

/**
 * Props for `FaqAccordion`.
 */
export type FaqAccordionProps = SliceComponentProps<Content.FaqAccordionSlice>;

type SidebarNavLink = {
  category_title?: string | null;
  link_label?: string | null;
  topic?: string | null;
};

/**
 * Sidebar-nav variation: groups links by category, drives `activeTopic` via FaqTopicProvider.
 */
function FaqAccordionSidebarNav({ slice }: { slice: Content.FaqAccordionSliceSidebarNav }) {
  const { activeTopic, setActiveTopic } = useFaqTopic();
  const router = useRouter();
  const pathname = usePathname();

  const links = (slice.primary.links ?? []) as SidebarNavLink[];

  const grouped = links.reduce<Record<string, SidebarNavLink[]>>((acc, item) => {
    const category = item.category_title ?? "";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const categories = Object.entries(grouped);

  const handleSelect = (topic: string | null | undefined) => {
    if (!topic) return;
    setActiveTopic(topic);
    router.replace(`${pathname}?topic=${topic}`, { scroll: false });
  };

  return (
    <nav
      aria-label="FAQ categories"
      className="faq-sidebar w-full"
      data-slice-type="faq_accordion"
      data-slice-variation={slice.variation}
    >
      <Accordion type="single" collapsible defaultValue={categories[0]?.[0]}>
        {categories.map(([category, items]) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="font-semibold text-primary-700">
              {category}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={`${category}-${item.link_label}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.topic)}
                      aria-current={activeTopic === item.topic ? "true" : undefined}
                      className={`flex w-full items-center justify-between py-2 text-left text-sm hover:text-primary-700 ${
                        activeTopic === item.topic
                          ? "font-medium text-primary-700"
                          : "text-gray-700"
                      }`}
                    >
                      {item.link_label}
                      <span aria-hidden="true">&rsaquo;</span>
                    </button>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </nav>
  );
}

/**
 * Component for "FaqAccordion" Slices.
 */
const FaqAccordion: FC<FaqAccordionProps> = ({ slice }) => {
  if (slice.variation === "sidebar_nav") {
    return <FaqAccordionSidebarNav slice={slice} />;
  }

  return (
    <section data-slice-type={slice.slice_type} data-slice-variation={slice.variation}>
      {slice.primary.title ? (
        <h2 className="mb-4 font-semibold text-xl">{slice.primary.title}</h2>
      ) : null}
      <Accordion type="single" collapsible className="space-y-2">
        {(slice.primary.qa ?? []).map((item) => (
          <AccordionItem key={`${slice.id ?? "faq"}-${item.question}`} value={item.question ?? ""}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <PrismicRichText field={item.answer} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};

export default FaqAccordion;
