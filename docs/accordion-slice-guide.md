# Building an Accordion slice with shadcn/ui and Prismic

A step-by-step guide to creating a collapsible-sections slice, based on this project's [Accordion](../packages/cms/src/slices/Accordion/README.md). It works with models managed in **Prismic's Type Builder** (no local `model.json` needed) and shows a minimal version first, then the optional extras this project added.

## What you get

- Collapsible sections that use shadcn/ui's `Accordion` (Radix underneath: keyboard navigation, ARIA and animation for free).
- Numbered or plain titles (`hide_number`), and each section collapsed by default with a **Start expanded** checkbox.
- Optional extras (add them as you need them): a highlighted note, grey cards, download buttons, a footnote, trailing links.

## 1. Prerequisites

1. **shadcn/ui set up** in the app or UI package (`npx shadcn@latest init`), on Tailwind v4.
2. **Add the components:**

   ```bash
   npx shadcn@latest add accordion
   # only if you build the extras:
   npx shadcn@latest add card button
   ```

   This creates `accordion.tsx` (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`). The trigger already includes a chevron icon that flips when open.
3. **Animations:** the accordion uses the `animate-accordion-down` / `animate-accordion-up` classes (from `tw-animate-css` or your Tailwind config). Make sure they exist, otherwise sections open without animation.
4. **Monorepo only:** Tailwind v4 generates only the classes it can see. If the slice lives in a different package than the app's CSS, add an `@source` line for that package in the app's `globals.css`, or its classes silently won't exist:

   ```css
   @import "tailwindcss";
   @source "../../../packages/ui/src";
   @source "../../../packages/cms/src";
   ```

5. **Prismic packages:** `@prismicio/client`, `@prismicio/react` (and `@prismicio/next` if you use `PrismicNextLink` / `PrismicNextImage`).

## 2. Create the slice in the Type Builder

In the Prismic dashboard: **Slices → Create a slice**, name it `Accordion` (API id `accordion`), variation `default`. Add these fields. **API ids matter** — the component reads them by name.

### Minimal set

| Zone | API id | Type | Settings |
| --- | --- | --- | --- |
| Primary | `hide_number` | Boolean | Label "Hide numbers", default **false** (placeholder: false = "Numbered", true = "Unnumbered") |
| Items (repeatable) | `start_expanded` | Boolean | Label "Start expanded", default **false** (false = "Collapsed", true = "Expanded") |
| Items | `title` | Text | Label "Title" |
| Items | `body` | Rich Text | Allow: Paragraph, Bold, Italic, Hyperlink, Bulleted list, Numbered list. Labels: `muted`, `small` |

### Optional extras (add later, one at a time)

| API id | Type | Settings | Use |
| --- | --- | --- | --- |
| `note` | Text | — | One-line highlighted box above the body |
| `cards` | Rich Text | Allow: **Heading 4**, Paragraph, Bold, Italic, Hyperlink, lists, Image. Labels: `muted`, `small`, `roman` | Grey cards — **every Heading 4 starts a new card** |
| `file_1_heading`, `file_1_label`, `file_1`, `file_1_size` | Text, Text, Link (allow new tab), Text | — | A download button (repeat for `file_2`, `file_3`) |
| `downloads_card` | Number | Label "Downloads go in card # (blank = last card)" | Which card holds the download buttons |
| `footnote` | Rich Text | Allow: Paragraph, Bold, Italic, Hyperlink | Small muted text after the cards |
| `necessities_heading`, `necessities` | Text, Rich Text (Heading 4, Paragraph…) | — | A bordered checklist box |
| `link_label`, `link`, `link2_label`, `link2` | Text, Link | — | Up to two trailing links |

Prismic limits that shape this model:
- A **Group cannot be nested** in a Group or in a repeatable `items` zone. That is why the download buttons are flat fields (`file_1`, `file_2`, `file_3`) — capped at three.
- Rich text has only bullet and numbered lists. For Roman numerals (i, ii, iii) this project applies an inline **`roman` label** to a numbered list (see [section 6](#6-content-tips-for-editors)).
- Give **new fields a default that keeps the old behaviour**: an unset Boolean is `false`, an unset Number is `null`.

Save the slice, then **add it to the page type's slice zone** (Custom types → your page type → the zone → add `Accordion`).

## 3. The minimal component

Server component, using the shadcn accordion. Adjust the import path (`ui` here is a workspace package; in a plain app it is usually `@/components/ui/accordion`).

```tsx
import { Content } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "ui";

export type AccordionProps = SliceComponentProps<Content.AccordionSlice>;

const itemValue = (index: number) => `item-${index}`;

export default function AccordionSlice({ slice }: AccordionProps) {
  const showNumber = !slice.primary.hide_number;

  // Collapsed by default: only items ticked "Start expanded" are open.
  const openValues = slice.items.flatMap((item, index) =>
    item.start_expanded ? [itemValue(index)] : [],
  );

  return (
    <Accordion
      type="multiple"
      defaultValue={openValues}
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      {slice.items.map((item, index) => (
        <AccordionItem key={`${item.title}-${index}`} value={itemValue(index)}>
          <AccordionTrigger className="cursor-pointer items-center! gap-2.5 py-5! text-base hover:no-underline">
            {showNumber ? (
              <span className="shrink-0 font-bold text-primary">{index + 1}</span>
            ) : null}
            <span className="flex-1 font-bold">{item.title}</span>
          </AccordionTrigger>

          <AccordionContent className="pb-6! text-base [&_a]:text-primary [&_p]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
            <PrismicRichText field={item.body} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
```

Why it is written this way:
- `type="multiple"` lets any number of sections be open. Use `type="single" collapsible` if only one may be open at a time (then `defaultValue` is a single string).
- `defaultValue` lists the **open** items. An empty array means everything starts collapsed.
- Item values come from the array index (`item-0`, `item-1`, …), which is also what numbers the titles — reordering items in Prismic renumbers them automatically.
- The `!` suffix (`items-center!`, `py-5!`, `pb-6!`) overrides shadcn's default classes, whose specificity wins over plain utilities. Prefer overriding in the slice over editing the shared shadcn file.
- `hover:no-underline` removes shadcn's underline-on-hover from the whole trigger. If you want an underline on the title only, put `group-hover/accordion-trigger:underline` on the title `span`.

> `Content.AccordionSlice` comes from your generated Prismic types. If your project generates types from the Type Builder models, regenerate them after saving the slice. If you don't have generated types, type the props by hand (`SliceComponentProps<{ slice_type: "accordion"; primary: { hide_number?: boolean }; items: { title: string | null; start_expanded?: boolean | null; body: RichTextField }[] }>`).

## 4. Register the slice

Wherever you map slice types to components (a `SliceZone` `components` map or your own registry), add the slice:

```tsx
const components = {
  accordion: AccordionSlice,
  // …other slices
};
```

## 5. Adding the extras

Each extra is independent — add the field in the Type Builder first, then the code.

| Extra | Implementation notes |
| --- | --- |
| **Note** | A grey box above the body. Render `item.note` inside a `Card` (or a `div` with `bg-…` and `px-8 py-7`). |
| **Cards** | Split the rich text so every `heading4` starts a new card, then render each card in its own box. The split is a pure function, so unit-test it — see [`cards.ts`](../packages/cms/src/slices/Accordion/cards.ts) and [`cards.test.ts`](../packages/cms/src/slices/Accordion/cards.test.ts). Images are allowed inside cards: give `PrismicRichText` an `image` serializer that renders `PrismicNextImage`. |
| **Downloads** | Loop over slots `1..3`, rendering a shadcn `Button` (`variant="outline"`, `asChild` around `PrismicNextLink`) plus a "File Size: …" caption. Put them **inside the card** chosen by `downloads_card` (the last card if blank); with no cards, in a card of their own. See [`Downloads.tsx`](../packages/cms/src/slices/Accordion/Downloads.tsx) and [`ItemBoxes.tsx`](../packages/cms/src/slices/Accordion/ItemBoxes.tsx). |
| **Footnote / necessities / links** | Plain `PrismicRichText` blocks and `PrismicNextLink`s after the cards. |
| **Roman lists** | A serializer for `oList` that checks whether any item carries the `roman` label and, if so, sets `style={{ listStyleType: "lower-roman" }}`. See [`lists.tsx`](../packages/cms/src/slices/Accordion/lists.tsx). |
| **Custom trigger icon** | Hide the shared chevrons and draw your own inside the trigger (this project uses a Google Material Symbols icon). Not needed if shadcn's chevron is fine — keep it. |
| **Translatable strings** | Text such as "File Size" belongs in your app's i18n, not in Prismic fields. This project passes it to slices as an optional `context` prop from the page (`SliceRenderer`). |

Keep the box padding, colours and typography in **one place** (this project has an [`InfoBox`](../packages/cms/src/slices/Accordion/InfoBox.tsx) component and a [`styles.ts`](../packages/cms/src/slices/Accordion/styles.ts) with the class strings), so a design change is a one-line edit.

## 6. Content tips for editors

- **Cards:** start each card with a **Heading 4**; everything until the next Heading 4 is inside that card.
- **Downloads in a specific card:** set `downloads_card` to that card's position (1, 2, …). It is a *position*, so update it if cards are added above.
- **Line breaks without a paragraph gap:** press **Shift+Enter** inside a paragraph.
- **Roman-numeral list:** make a **numbered** list, then apply the **`roman`** label (text-style dropdown) to any one item — the whole list becomes i, ii, iii.
- **Expanded sections:** tick **Start expanded** on each section that should be open when the page loads. The default is collapsed.

## 7. Styling checklist

- Measure the design in browser DevTools (padding, margin, font size, line height, colour) and copy the exact values — do not eyeball them.
- Put shared off-palette colours in theme tokens (Tailwind v4 `@theme inline { --color-… }`) instead of raw hex values in several files.
- Inside the panel, shadcn styles every `p` and `a`. To change them, override with arbitrary variants on the content wrapper (`[&_p]:mt-4`, `[&_a]:text-primary`) — and add `!` when a plain utility loses.
- `list-inside` + `pl-0` puts list markers at the same left edge as the paragraphs; use `list-outside` + padding if long items must wrap under their text.
- Add `cursor-pointer` to the trigger (Tailwind v4 no longer sets a pointer cursor on buttons).

## 8. Pitfalls we hit

| Problem | Cause / fix |
| --- | --- |
| Classes from the slice don't apply | The slice's package isn't in `@source` in `globals.css` (monorepo). |
| Fonts/icons vanish or the build fails after adding a font `@import` | A CSS `@import url(...)` must come before Tailwind's generated rules — load web fonts with a `<link>` in the layout instead. |
| Hover turns links black / adds underlines | shadcn's content wrapper styles `a`. Override with `[&_a]:hover:text-primary [&_a]:no-underline [&_a]:hover:underline`. |
| Link hover area spans the whole row | The link is `display: flex`. Add `w-fit`. |
| Old pages suddenly collapse/expand | New Boolean fields default to `false`. Choose the field's meaning so the default is the behaviour you want for existing content (here: collapsed by default, `start_expanded` opts in). |
| A slice disappears after removing it from code | An unregistered slice renders nothing/a warning. Prove no document uses it before deleting (query each slice zone), and migrate content first. |
| Type errors after changing fields | Regenerate the Prismic types after every Type Builder change. |

## 9. Verification

- Type-check the project and unit-test any pure helpers (card splitting, open-state, list-style detection).
- Load a page with **all** the states: numbered and unnumbered, everything collapsed, mixed expanded, a section with only a body, and a section with cards + downloads + footnote.
- Keyboard: Tab to a trigger, press Enter/Space to toggle; check the focus ring is visible.
- Compare against the design at the measured values, not by eye.

## Reference implementation in this repo

- Slice: [`packages/cms/src/slices/Accordion/`](../packages/cms/src/slices/Accordion/) (component split into `index.tsx`, `ItemBoxes.tsx`, `Downloads.tsx`, `InfoBox.tsx`, `lists.tsx`, `cards.ts`, `styles.ts`)
- Field reference and limitations: [Accordion README](../packages/cms/src/slices/Accordion/README.md)
- Shared shadcn component: [`packages/ui/src/accordion.tsx`](../packages/ui/src/accordion.tsx)
