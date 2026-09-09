# Slice Library

This project's pages (`content_page` in Prismic) are built entirely from **shared slices** — reusable, independently-editable content blocks. Every slice lives in its own folder here (`slices/<Name>/`) with three co-located files:

| File | Purpose |
|---|---|
| `model.json` | The Prismic schema — field definitions, pushed to the live repo via `npx prismic push`. This is the source of truth; `prismicio-types.d.ts` is generated from it. |
| `index.tsx` | The React component that renders the slice, built on [shadcn/ui](https://ui.shadcn.com) primitives (`@/components/ui/*`) where one fits, and Tailwind utility classes for everything else. |
| `README.md` | Field reference, usage examples, and known limitations for this slice. |

## How pages are assembled

A `content_page` document has four slice zones — **Heading**, **Main**, **Aside**, **Footer** — each a free-form ordered list of slice instances. `app/[uid]/page.tsx` renders each zone via `@prismicio/react`'s `<SliceZone>`, which looks up the right component for each slice by its `id` in the `components` map exported from `slices/index.ts`. Adding a slice to a page is a content operation (done in Prismic, or via the MCP server); adding a **new kind** of slice is a code change (a new folder here, registered in `slices/index.ts` and in `content_page`'s zone `choices`).

The page layout itself (`app/[uid]/page.tsx`) is a responsive grid: Main + Aside side by side on `md:` and up (2fr/1fr), Main spanning full width when a page has no Aside content, Footer spanning full width and laying its children out as a 4-column grid on `sm:` and up.

## Slice index

| Slice | One-line purpose | Variations |
|---|---|---|
| [`Accordion`](Accordion/README.md) | Numbered, individually collapsible step-by-step sections | `default` |
| [`Breadcrumbs`](Breadcrumbs/README.md) | Home › Level 1 › Level 2 › Level 3 trail | `default` |
| [`ButtonLink`](ButtonLink/README.md) | A single centered outline CTA button | `default` |
| [`Callout`](Callout/README.md) | A bordered, colored box for a note/warning/highlight | `default` |
| [`DisclosureList`](DisclosureList/README.md) | One collapsible topic with an optional box, download buttons, and a link | `default` |
| [`FaqAnswerSwap`](FaqAnswerSwap/README.md) | Client-side Q&A card with a related-question switcher (no navigation) | `default` |
| [`FaqQuestionList`](FaqQuestionList/README.md) | FAQ category/question lists — 5 different layouts | `default`, `grid`, `accordion`, `footer_grid`, `withicon` |
| [`FileDownloadList`](FileDownloadList/README.md) | Outline download buttons with a file-size caption | `default` |
| [`ImageBlock`](ImageBlock/README.md) | A single image with an optional caption | `default` |
| [`InfoCardList`](InfoCardList/README.md) | Stacked bordered info cards (title + body) | `default` |
| [`LinkList`](LinkList/README.md) | An optional heading + a stacked list of chevron links | `default` |
| [`PageTitle`](PageTitle/README.md) | The page's H1 + optional subtitle | `default` |
| [`RichTextSection`](RichTextSection/README.md) | Heading + body rich text, with per-block/per-line size & color | `default` |

## Conventions used across every slice

- **`data-slice-type` / `data-slice-variation`** attributes are always present on the slice's root element — useful for debugging which variation rendered, and as CSS/e2e-test hooks.
- **shadcn primitives** (`Accordion`, `Card`, `Button` from `@/components/ui/*`) are used wherever the design calls for that pattern, rather than hand-rolled markup — see [shadcn/ui docs](https://ui.shadcn.com) for the underlying Radix behavior (keyboard nav, ARIA, animation).
- **Design tokens**: color comes from the shared token set in `app/globals.css` (`text-primary`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `bg-accent`, `border`) — never a raw hex value, except where a design explicitly calls for an off-palette color (e.g. `Callout`'s warning/success tints).
- **Rich text styling**: `PrismicRichText` renders raw `<p>`/`<h2>`/`<a>` tags that can't take a `className`, so slices style them via Tailwind v4's arbitrary descendant-selector syntax on the wrapping element (`[&_p]:mb-3`, `[&_a]:text-primary`, etc.) rather than global CSS.
- **Chevron links**: any slice offering a single "read more"-style trailing link (`Accordion`, `DisclosureList`, `LinkList`) renders it via the shared [`ChevronLink`](../components/ui/chevron-link.tsx) component (`font-semibold text-primary`, trailing `›` via `after:content-['\203A']` — pass `chevron={false}` for a plain inline link with no trailing `›`/row spacing, as `DisclosureList` does).
- **Rich-text `label` spans**: any `PrismicRichText` field whose model config has a `labels` list (muted/small/large/accent/highlight/underline) should pass the shared [`richTextLabelComponents`](../lib/rich-text-components.tsx) as its `components` prop — otherwise an editor applying one of those labels in the toolbar renders as an unstyled `<span>` with no visible effect. `RichTextSection` and `Accordion` (`body`/`necessities`) use it today.
- **Placeholder links**: when authoring content for a slice's `Link` field before the real destination page/asset exists, this project's convention is `#`, not a guessed URL.
- **Flat-slice limitation**: Prismic shared slices cannot nest a repeatable `Group` field inside another repeatable `items` zone (confirmed by a rejected push — see `FaqQuestionList`'s `footer_grid` variation history). Where a design needs "N categories, each with M links," the fix used here is **one slice instance per category**, all sharing the same zone — never a nested structure. A Group directly on a variation's `primary` is fine, though — `DisclosureList`'s `files` field uses exactly that, which is why that slice has no `items` at all (each instance is already one topic, so there's nothing to repeat at the top level).
- **Server by default, client only when interactivity requires it**: every slice is a plain server component except [`FaqAnswerSwap`](FaqAnswerSwap/README.md), which needs local `useState` to swap its active item without a page navigation — it's the one slice marked `"use client"`. Default to a server component; reach for a client component only when the design needs in-place state that a link/navigation genuinely can't express.
