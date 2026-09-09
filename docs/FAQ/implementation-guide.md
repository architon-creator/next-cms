# FAQ Pages — Implementation Guide (Level 1 / 2 / 3)

> ⚠️ **Superseded by the real project's own FAQ implementation.** This guide documents this sandbox repo's earlier, simpler prototype (per-category slice instances, a `current: Boolean` flag to mark the active one, client-side-only swapping with no URL sync). The real project already has a more advanced, working design: topic-keyed `Select` fields correlating `FaqAccordion`/`QuestionListSlice`/`QuestionAnswerSlice`, a shared `FaqTopicProvider` Context with fully-derived "current" state (no boolean flags to keep in sync), and `router.replace(...?topic=X, {scroll:false})` keeping every click shareable via URL. Do not use this guide (or hand it to Copilot) for the real project — it would be a downgrade from what's already built there. Kept here only as a record of the earlier prototype.

A step-by-step build guide for the 3-level FAQ system (hub → category → question), extracted from a working reference implementation. Follow the steps in order — later steps assume earlier ones are done. Hand this whole file to a developer or an AI coding assistant (e.g. GitHub Copilot) alongside one existing slice folder as a template; the combination of prose + concrete code is what makes it reproducible without drift.

## 0. Prerequisites

This guide assumes your project already has:

- **Prismic** wired up: `@prismicio/client`, `@prismicio/next`, `@prismicio/react`, a `prismicio.ts` (or `.js`) exporting `createClient()`, and a `content_page` custom type (repeatable, with `uid`).
- **shadcn/ui** installed with Tailwind v4, and these primitives added: `accordion`, `card` (`npx shadcn@latest add accordion card` if missing).
- A `cn()` helper at `@/lib/utils` (shadcn's default scaffold provides this).
- A page template that renders a `content_page` document's slice zones via `<SliceZone>` — see [Step 2](#step-2-page-template) if you don't have one yet.

If any of these are missing, set them up first; this guide only covers the FAQ-specific pieces on top of that foundation.

## 1. Data model overview

Three levels of `content_page` documents, sharing the same zone shape:

| Level | Purpose | Example UID |
|---|---|---|
| **1 — Hub** | Lists every category, each with all its questions inline. Entry point (e.g. `/faq`). | `faq` |
| **2 — Category** | One page per category, listing that category's questions as a nav list. | `network-and-timetable` |
| **3 — Question** | Shows one question's answer, with a switcher to related questions in the same category — no page reload when switching. | `where-does-zipair-fly-to` |

Zone usage per level:

| Zone | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| **Heading** | *(none — flat hub page)* | `PageTitle` + `Breadcrumbs` | `PageTitle` + `Breadcrumbs` |
| **Main** | N× `FaqQuestionList` (`grid`) — one per category | 1× `FaqQuestionList` (`default`) | 1× `FaqAnswerSwap` |
| **Aside** | *(none)* | N× `FaqQuestionList` (`accordion`) — one per category, current one expanded | Same as Level 2 |
| **Footer** | *(none)* | N× `FaqQuestionList` (`footer_grid`) — one per category, 4-col grid | Same as Level 2 |

All category-list slices (`grid`/`accordion`/`footer_grid`) point at the **same set of URLs** and are independent slice instances with duplicated link data — there's no shared data source. Adding a category means updating it in 3 places (the level-1 `grid` block, and every level-2/3 page's `accordion` + `footer_grid` instances). This is a deliberate consequence of a hard Prismic constraint — see [Pitfall 1](#pitfalls--gotchas).

## 2. Page template

If you don't already have one, create `app/[uid]/page.tsx`:

```tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { SliceZone } from "@prismicio/react";

import { createClient } from "@/prismicio";
import { components, PageContext } from "@/slices";
import { cn } from "@/lib/utils";

type PageProps = { params: { uid: string } };

export default async function Page({ params }: PageProps) {
  const client = createClient();
  const page = await client
    .getByUID("content_page", params.uid)
    .catch(() => notFound());

  const context: PageContext = {
    breadcrumbs: [
      { label: page.data.breadcrumb_level_1_label, href: page.data.breadcrumb_level_1_href },
      { label: page.data.breadcrumb_level_2_label, href: page.data.breadcrumb_level_2_href },
      { label: page.data.breadcrumb_level_3_label, href: page.data.breadcrumb_level_3_href },
    ],
  };

  const hasAside = page.data.aside.length > 0;
  const hasFooter = page.data.footer.length > 0;

  return (
    <div
      className={cn(
        "mx-auto grid max-w-[1200px] grid-cols-1 gap-8 p-6",
        hasAside && "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
      )}
    >
      <div className="md:col-span-2">
        <SliceZone slices={page.data.heading} components={components} context={context} />
      </div>

      <main className={cn("min-w-0", !hasAside && "md:col-span-2")}>
        <SliceZone slices={page.data.main} components={components} context={context} />
      </main>

      {hasAside ? (
        <aside className="min-w-0">
          <SliceZone slices={page.data.aside} components={components} context={context} />
        </aside>
      ) : null}

      {hasFooter ? (
        <footer className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-4 md:col-span-2">
          <SliceZone slices={page.data.footer} components={components} context={context} />
        </footer>
      ) : null}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const client = createClient();
  const page = await client.getByUID("content_page", params.uid).catch(() => notFound());
  return { title: page.uid };
}

export async function generateStaticParams() {
  const client = createClient();
  const pages = await client.getAllByType("content_page");
  return pages.map((page) => ({ uid: page.uid! }));
}
```

If your `content_page` type doesn't yet have `breadcrumb_level_{1,2,3}_label`/`_href` Text fields on it, add them (plain Text fields, not repeatable) — they feed `PageTitle`'s sibling, `Breadcrumbs`, via `PageContext`.

The `PageContext` type and `components` map are defined in `slices/index.ts` — created in [Step 8](#step-8-register-the-slices).

## 3. Custom type: zone choices

In your `content_page` custom type, add these shared slices as `choices` on the relevant zones (Prismic dashboard → Custom Types → Content Page → edit each zone; or hand-edit `customtypes/content_page/index.json` if you use the local Slice Machine file workflow):

- **Heading zone**: `page_title`, `breadcrumbs`
- **Main zone**: `page_title`, `breadcrumbs`, `faq_question_list`, `faq_answer_swap`
- **Aside zone**: `faq_question_list`
- **Footer zone**: `faq_question_list`

(`page_title`/`breadcrumbs` in Main too is only needed if you want the option of using them outside the Heading zone — harmless to include, skip if you want a stricter model.)

## 4. Slice: PageTitle

`slices/PageTitle/model.json`:

```json
{
  "id": "page_title",
  "type": "SharedSlice",
  "name": "PageTitle",
  "description": "The page's H1 and an optional subtitle",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Default",
      "imageUrl": "",
      "primary": {
        "title": {
          "type": "StructuredText",
          "config": { "label": "Title", "placeholder": "", "single": "heading1" }
        },
        "subtitle": {
          "type": "Text",
          "config": { "label": "Subtitle", "placeholder": "" }
        }
      },
      "items": {}
    }
  ]
}
```

`slices/PageTitle/index.tsx`:

```tsx
import { Content } from "@prismicio/client";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

export type PageTitleProps = SliceComponentProps<Content.PageTitleSlice>;

const components: JSXMapSerializer = {
  heading1: ({ children }) => (
    <h1 className="mb-2 text-4xl font-semibold">{children}</h1>
  ),
};

export default function PageTitle({ slice }: PageTitleProps) {
  return (
    <section
      className="mt-4"
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicRichText field={slice.primary.title} components={components} />
      {slice.primary.subtitle ? (
        <p className="text-muted-foreground">{slice.primary.subtitle}</p>
      ) : null}
    </section>
  );
}
```

## 5. Slice: Breadcrumbs

`slices/Breadcrumbs/model.json`:

```json
{
  "id": "breadcrumbs",
  "type": "SharedSlice",
  "name": "Breadcrumbs",
  "description": "Home › Level 1 › Level 2 › Level 3 trail",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Default",
      "imageUrl": "",
      "primary": {
        "separator": {
          "type": "Text",
          "config": { "label": "Separator", "placeholder": "/" }
        }
      },
      "items": {}
    }
  ]
}
```

`slices/Breadcrumbs/index.tsx`:

```tsx
import { Content } from "@prismicio/client";
import { SliceComponentProps } from "@prismicio/react";

import { PageContext } from "@/slices";

export type BreadcrumbsProps = SliceComponentProps<Content.BreadcrumbsSlice, PageContext>;

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ChevronSeparator() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className="text-muted-foreground">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function Breadcrumbs({ slice, context }: BreadcrumbsProps) {
  const crumbs = (context?.breadcrumbs ?? []).filter((crumb) => crumb.label);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" data-slice-type={slice.slice_type} data-slice-variation={slice.variation}>
      <ol className="m-0 flex list-none items-center gap-1.5 p-0">
        <li className="flex items-center gap-1.5">
          <a href="/" className="inline-flex text-primary" aria-label="Home">
            <HomeIcon />
          </a>
          <ChevronSeparator />
        </li>
        {crumbs.map((crumb, index) => (
          <li className="flex items-center gap-1.5" key={`${crumb.label}-${index}`}>
            {crumb.href ? (
              <a href={crumb.href} className="text-muted-foreground no-underline hover:text-primary">
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
```

Note: this renders plain `<a>` tags (full page reload on click), which is fine for breadcrumbs (rare navigation, low-traffic clicks). It does **not** matter here the way it matters for `FaqQuestionList` below.

## 6. Slice: FaqQuestionList

The workhorse — 4 variations covering every FAQ layout need. All variations share the same item shape (`question`: Text, `href`: Text — a plain string URL, not a Prismic Link field).

`slices/FaqQuestionList/model.json`:

```json
{
  "id": "faq_question_list",
  "type": "SharedSlice",
  "name": "FaqQuestionList",
  "description": "FAQ category/question lists",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Category page list of FAQ questions",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "label": "Heading", "single": "heading2,heading3,strong,em" }
        },
        "description": {
          "type": "StructuredText",
          "config": { "label": "Description", "multi": "paragraph,strong,em,hyperlink" }
        }
      },
      "items": {
        "question": { "type": "Text", "config": { "label": "Question" } },
        "href": { "type": "Text", "config": { "label": "Href" } }
      }
    },
    {
      "id": "grid",
      "name": "grid",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Level-1 hub category block (heading + inline-wrapped topic links)",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "label": "Heading", "single": "heading2,heading3,strong,em" }
        },
        "description": {
          "type": "StructuredText",
          "config": { "label": "Description", "multi": "paragraph,strong,em,hyperlink" }
        }
      },
      "items": {
        "question": { "type": "Text", "config": { "label": "Question" } },
        "href": { "type": "Text", "config": { "label": "Href" } }
      }
    },
    {
      "id": "accordion",
      "name": "accordion",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Collapsible category block for a sidebar list of categories",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "label": "Heading", "single": "heading2,heading3,strong,em" }
        },
        "current": {
          "type": "Boolean",
          "config": { "label": "Current Category (starts expanded)", "placeholder": "false" }
        }
      },
      "items": {
        "question": { "type": "Text", "config": { "label": "Question" } },
        "href": { "type": "Text", "config": { "label": "Href" } }
      }
    },
    {
      "id": "footer_grid",
      "name": "footer_grid",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Always-visible category tile for a multi-column footer grid",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "label": "Heading", "single": "heading2,heading3,strong,em" }
        },
        "mobile_section_heading": {
          "type": "Text",
          "config": {
            "label": "Mobile Section Heading",
            "placeholder": "Set on the FIRST tile only, shown above the whole grid on mobile"
          }
        }
      },
      "items": {
        "question": { "type": "Text", "config": { "label": "Question" } },
        "href": { "type": "Text", "config": { "label": "Href" } }
      }
    }
  ]
}
```

`slices/FaqQuestionList/index.tsx`:

```tsx
import Link from "next/link";
import { Content } from "@prismicio/client";
import { JSXMapSerializer, PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FaqQuestionListProps = SliceComponentProps<Content.FaqQuestionListSlice>;

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const headingComponents: JSXMapSerializer = {
  heading2: ({ children }) => <h2 className="flex-1 text-base font-bold">{children}</h2>,
  heading3: ({ children }) => <h3 className="flex-1 text-base font-bold">{children}</h3>,
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
      <div data-slice-type={slice.slice_type} data-slice-variation={slice.variation}>
        <div className="hidden sm:block">
          <div className="mb-3 font-bold">
            <PrismicRichText field={slice.primary.heading} components={headingComponents} />
          </div>
          {links}
        </div>

        <div className="sm:hidden">
          {slice.primary.mobile_section_heading ? (
            <h2 className="mb-2 text-xl font-bold">{slice.primary.mobile_section_heading}</h2>
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
              <Link key={`${item.question}-${index}`} href={item.href} className="text-primary underline">
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
    <section className="mt-6" data-slice-type={slice.slice_type} data-slice-variation={slice.variation}>
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
```

## 7. Slice: FaqAnswerSwap

The level-3 "active answer + related-question switcher" card. This is the **only client component** in this guide (`"use client"`) — it needs local state to swap the active question without a page reload.

`slices/FaqAnswerSwap/model.json`:

```json
{
  "id": "faq_answer_swap",
  "type": "SharedSlice",
  "name": "FaqAnswerSwap",
  "description": "A Q&A card with a related-question switcher that swaps the active answer client-side, no page navigation",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Active question/answer card + related-question list",
      "imageUrl": "",
      "primary": {
        "related_heading": {
          "type": "Text",
          "config": { "label": "Related heading", "placeholder": "Related question" }
        }
      },
      "items": {
        "question": { "type": "Text", "config": { "label": "Question", "placeholder": "" } },
        "answer": {
          "type": "StructuredText",
          "config": {
            "label": "Answer",
            "multi": "paragraph,strong,em,hyperlink,list-item,o-list-item",
            "placeholder": ""
          }
        }
      }
    }
  ]
}
```

`slices/FaqAnswerSwap/index.tsx`:

```tsx
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
    <div className="mt-6 flex flex-col gap-4" data-slice-type={slice.slice_type} data-slice-variation={slice.variation}>
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
```

**Design choice worth knowing**: `FaqAnswerSwap`'s items are **not separately routable** — only the page it's on has a URL. Use it only when a small group of questions genuinely don't need their own individually-indexable/deep-linkable pages. If they do (SEO, sharing a direct link to one answer), use `FaqQuestionList`'s `default` variation instead — plain navigation between real pages, no client state involved.

## 8. Register the slices

`slices/index.ts`:

```ts
import Breadcrumbs from "./Breadcrumbs";
import FaqAnswerSwap from "./FaqAnswerSwap";
import FaqQuestionList from "./FaqQuestionList";
import PageTitle from "./PageTitle";
// ...import your other existing slices here

export type PageContext = {
  breadcrumbs: { label: string | null; href: string | null }[];
};

export const components = {
  breadcrumbs: Breadcrumbs,
  faq_answer_swap: FaqAnswerSwap,
  faq_question_list: FaqQuestionList,
  page_title: PageTitle,
  // ...your other existing slices here
};
```

If `slices/index.ts` already exists with other slices registered, just add these four imports and four map entries — don't replace the file.

## 9. Push schema & generate types

```bash
npx prismic push
npm run types   # or your project's prismic-ts-codegen script
npx tsc --noEmit   # confirm no type errors before writing content
```

If `prismic push` reports it would **delete** models you didn't intend to remove, stop and check `git status`/`npx prismic status` before proceeding — don't `--force` past an unexpected deletion.

## 10. Author content

### Level 1 (hub) — one document, e.g. `faq`

Main zone: one `FaqQuestionList` (`grid`) instance per category.

```json
{
  "primary": {
    "heading": [{ "type": "heading3", "content": { "text": "About Reservations", "spans": [] } }]
  },
  "items": [
    { "question": "Network and Timetable", "href": "/network-and-timetable" },
    { "question": "Booking", "href": "#" },
    { "question": "Payment", "href": "/payment" }
  ]
}
```

Repeat for each category, stacked in the same Main zone. No Heading/Aside/Footer content needed at this level (see [Pitfall 5](#pitfalls--gotchas) if you want them anyway).

### Level 2 (category) — one document per category, e.g. `network-and-timetable`

- **Heading**: `PageTitle` (title = category name) + `Breadcrumbs`.
- **Main**: one `FaqQuestionList` (`default`) with that category's questions.
- **Aside**: one `FaqQuestionList` (`accordion`) **per category** (not just this one — all of them, so the sidebar shows every category), with `current: true` set only on the instance matching this page's own category.
- **Footer**: one `FaqQuestionList` (`footer_grid`) per category, same set as Aside. Set `mobile_section_heading` (e.g. `"User Guide"`) on the **first** tile only.

```json
// Main
{
  "primary": {},
  "items": [
    { "question": "Where does ZIPAIR fly to?", "href": "/where-does-zipair-fly-to" },
    { "question": "Where can I check the flight status?", "href": "#" }
  ]
}
```

```json
// Aside — repeat once per category; current:true only on the matching one
{
  "primary": {
    "heading": [{ "type": "heading3", "content": { "text": "About Reservations", "spans": [] } }],
    "current": true
  },
  "items": [
    { "question": "Network and Timetable", "href": "/network-and-timetable" },
    { "question": "Payment", "href": "/payment" }
  ]
}
```

### Level 3 (question) — one document per question (or per small related-question group), e.g. `where-does-zipair-fly-to`

- **Heading**: same as Level 2.
- **Main**: one `FaqAnswerSwap` instance — the "primary" question first in `items`, its siblings after.
- **Aside**/**Footer**: identical content to the parent Level 2 page (same category list, `current: true` still on this question's category).

```json
// Main
{
  "primary": { "related_heading": "Related question" },
  "items": [
    {
      "question": "Where does ZIPAIR fly to?",
      "answer": [{ "type": "paragraph", "content": { "text": "ZIPAIR currently flies to...", "spans": [] } }]
    },
    {
      "question": "Where can I check the flight status?",
      "answer": [{ "type": "paragraph", "content": { "text": "You can check flight status on...", "spans": [] } }]
    }
  ]
}
```

## Pitfalls & gotchas

Every one of these was hit for real while building this system — check your implementation against each before calling it done.

1. **Prismic cannot nest a repeatable `Group` field inside another repeatable `items` zone.** This is why "N categories, each with M links" is modeled as **one slice instance per category**, all stacked in the same zone — never as a single instance with nested groups. Attempting the nested version gets a real `400 Bad Request` from `customtypes.prismic.io/slices/update` on push. (A Group directly on a variation's `primary` — not inside `items` — is fine; that's a different, legal shape.)
2. **`href` in `FaqQuestionList`/`FaqAnswerSwap` context is a plain Text field, not a Prismic Link field.** Don't reach for `PrismicNextLink` here — use `next/link`'s `Link` directly with the string value.
3. **Always use `next/link`'s `Link`, never a raw `<a href>`, for same-app navigation.** A raw anchor forces a full browser page reload (visible flash, full re-render) on every click. `Link` does a client-side transition instead. This was a real bug: `FaqQuestionList` originally used `<a>` everywhere and every question-list click felt like a full page reload.
4. **`mobile_section_heading` (or any "set once per repeated group" field) must be set on exactly one instance in the group** — typically the first. Setting it on every instance repeats the heading once per category on mobile; setting it on none means the mobile view has no heading at all.
5. **Decide deliberately between "separate pages" and "one client-side swap card"** for a group of related questions:
   - Separate pages (`FaqQuestionList` `default`, normal `Link` navigation) — each question gets its own URL/SEO/breadcrumb. Use this whenever questions need to be independently linkable/indexable.
   - One `FaqAnswerSwap` card (client-side state, no navigation) — only the page's own URL exists; switching between questions is invisible to the URL bar, browser history, and search engines. Don't use this for content that needs to be deep-linked or is business-critical for SEO per-question.
   - Don't try to make a plain link list *look* like it's "inside" a collapsible/interactive element via CSS alone (matching backgrounds, touching border-radii) if it's actually a separate component — it will visually work until someone interacts with the surrounding collapse state, then break. Put related content in the same component/state scope if it needs to behave as one unit.
6. **A rich-text field's `labels` config (e.g. `muted`, `small`, `accent`, `highlight`) does nothing on its own.** You must also pass a matching `components` prop to `PrismicRichText` that maps each label to a Tailwind class, e.g.:
   ```tsx
   const richTextLabelComponents: JSXMapSerializer = {
     label: ({ node, children }) => (
       <span className={{ muted: "text-muted-foreground", small: "text-[0.875em]" }[node.data.label] ?? ""}>
         {children}
       </span>
     ),
   };
   ```
   Forgetting this means an editor can select "muted" in the toolbar and see zero visual effect — the label is stored but never rendered as anything.
7. **When migrating a slice's schema** (e.g. converting `items` to `primary` fields, or adding a field), **push the schema first, then immediately update every live document's content to match** — Prismic doesn't auto-migrate stored document content when a model changes. A field removed from the model but still present in old document data is just ignored; a field added to the model is empty until you explicitly write it.
8. **Releases can auto-publish outside your control** (e.g. if the project owner has dashboard auto-publish, or publishes manually between your calls) — after any MCP `create_release`/`update_document` sequence, re-fetch the document before your next edit rather than assuming a `baseVersionId` is still valid. A `404 release_not_found` on `update_document` means exactly this — re-read and retry with a fresh release.
9. **Never call `publish_release` from an automated agent.** Stage changes in a release and point the content owner at the Prismic dashboard to review and publish.
10. **Test at both breakpoints** for `footer_grid` — it renders two separate DOM trees (`hidden sm:block` desktop, `sm:hidden` mobile-accordion) toggled by CSS, not JS. A bug in one tree won't show up testing only the other.

## Verification checklist

- [ ] `npx tsc --noEmit` passes after every schema + component change.
- [ ] Level 1 hub shows every category with all its questions, no page reload needed to browse the hub itself.
- [ ] Level 2 category page: Main list matches Aside/Footer category link, Aside's current category is expanded by default, Footer's mobile accordion works below `sm:`.
- [ ] Level 3 question page: clicking a related question swaps Card 1's content without a URL change or full-page flash; the Aside/Footer still show the correct (parent) category highlighted.
- [ ] Clicking any `FaqQuestionList` link does a client-side transition (no white-flash reload) — verify in the Network tab that it's not issuing a full document navigation.
- [ ] All content pushed via the Prismic dashboard/MCP is reviewed and published by a human, not auto-published by the agent.
