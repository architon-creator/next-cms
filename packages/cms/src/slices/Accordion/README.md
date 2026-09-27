# Accordion

Two variations serving two different jobs (see [When to use](#when-to-use)):

- **`default`** — a numbered (or plain) step-by-step list. One slice instance, many `items`, sharing one number sequence and one divider style.
- **`with_cards`** — one topic per slice instance, with a free-form **`blocks`** stream: text, images, cards, links and buttons, in any order, any count, freely reorderable by the editor — no rich-text markers, no fixed slots.

**Live examples**: Boarding Process (`boarding-process`, `default`, numbered), Special Assistance (`special-assistance`, `with_cards`, one slice instance per topic).

This slice replaces the former `DisclosureList` slice (see [Migrating from DisclosureList](#migrating-from-disclosurelist)).

## Why two variations

Prismic cannot nest a Group inside a repeatable `items` zone (see the [flat-slice limitation](../README.md#conventions-used-across-every-slice)). A topic that needs a flexible mix of cards, images, links and buttons needs a Group — so it **can't be an item of a shared numbered list**; it has to be its own slice instance, with that Group on `primary`. Sections that don't need that flexibility (plain numbered steps) don't pay that cost — they stay as `items` of one slice, as before.

## When to use

- An ordered sequence of simple steps, each collapsible → **`default`**, `hide_number` off.
- One topic per instance that just needs a title/body/necessities/links, or up to a few flexible blocks → **`with_cards`**.
- Sections start **collapsed** by default; tick `start_expanded` to start one open.

## When NOT to use

- More than two trailing links per section → put a [`LinkList`](../LinkList/README.md) slice after this one.
- A standalone list of cards that doesn't collapse → [`InfoCardList`](../InfoCardList/README.md).
- Downloads that aren't tied to a section → [`FileDownloadList`](../FileDownloadList/README.md).

## Variation: `default`

### Primary field

| Field         | Type    | Notes                                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `hide_number` | Boolean | Off (default) → numbered `1, 2, 3…`. On → plain titles.                                          |

### Item fields (repeatable `items`)

| Field                  | Type                                                                                                | Required | Notes                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`                | Text                                                                                                | Yes      | The section heading (next to its number, if numbered).                                                                                                 |
| `start_expanded`       | Boolean                                                                                             | No       | Off (default) → starts collapsed. On → starts expanded.                                                                                                |
| `note`                 | Text                                                                                                | No       | A single-line bold note in a grey box above the body.                                                                                                   |
| `body`                 | Rich Text (`paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted`, `small`, `roman`)  | No       | Main text.                                                                                                                                              |
| `necessities_heading`  | Text                                                                                                | No       | Small bold label above the necessities box. Only rendered if `necessities` has content.                                                                |
| `necessities`          | Rich Text (`heading4,paragraph,strong,em,hyperlink`)                                                | No       | A bordered (white) box. `heading4` = sub-item title, followed by a `paragraph`.                                                                        |
| `link_label`, `link`   | Text, Link (target-blank allowed)                                                                   | No       | First trailing chevron link (`Check-in ›`). Rendered only if `link` is filled.                                                                          |
| `link2_label`, `link2` | Text, Link (target-blank allowed)                                                                   | No       | Second trailing chevron link.                                                                                                                           |

**Render order:** `note` → `body` → `necessities_heading` + `necessities` → `link` → `link2`.

### Example: a numbered step with a note, necessities and a link

```json
{
  "title": "Check-in",
  "note": "From 3 hours to 1 hour before departure (check-in may start earlier depending on the number of passengers).",
  "body": [
    { "type": "paragraph", "content": { "text": "Please check in at the check-in counter one hour before departure...", "spans": [] } }
  ],
  "necessities_heading": "Necessities",
  "necessities": [
    { "type": "heading4", "content": { "text": "Itinerary", "spans": [] } },
    { "type": "paragraph", "content": { "text": "Present the printed paper or the electronic version sent by email.", "spans": [] } }
  ],
  "link_label": "Check-in",
  "link": { "url": "#" }
}
```

## Variation: `with_cards`

One slice instance = one collapsible topic. Stack several instances in the same slice zone for a page like Special Assistance (looks like one continuous accordion; see [border seam](#border-seam-between-stacked-with_cards-instances)).

### Primary fields

**Content**

| Field            | Type                                                                                              | Required | Notes                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `title`          | Text                                                                                                | Yes      | The topic heading.                                        |
| `start_expanded` | Boolean                                                                                             | No       | Off (default) → starts collapsed.                          |
| `note`           | Text                                                                                                | No       | Single-line bold note in a grey box above the body.        |
| `body`           | Rich Text (`paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted`, `small`, `roman`) | No       | Main text, before the `blocks` stream.                     |

**`blocks`** (Group, repeatable — see [Blocks](#blocks-the-flexible-content-stream))

**Necessities, footnote and links** — same fields and behaviour as the `default` variation's items: `necessities_heading`, `necessities`, `footnote` (Rich Text, `paragraph,strong,em,hyperlink`, labels `muted`/`small`), `link_label`/`link`, `link2_label`/`link2`.

**Render order:** `note` → `body` → `blocks` → `necessities_heading` + `necessities` → `footnote` → `link` → `link2`.

## Blocks: the flexible content stream

`blocks` is one repeatable **Group**. **Every item is a block; the editor fills in only the fields for whichever type that block is.** Order and count are just the Group's own order — drag to reorder, add or remove freely, in the Prismic dashboard, no markers or conventions to learn.

| Field(s)                         | Type                                                                                           | Renders as…                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `text`                             | Rich Text (`paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted`,`small`,`roman`) | A plain paragraph/list, not boxed.                                |
| `image`                            | Image                                                                                             | A standalone image.                                               |
| `card_heading`, `card_body`        | Text, Rich Text (adds `image`)                                                                    | A grey card (either field alone is enough to render the card).   |
| `link_label`, `link`               | Text, Link (target-blank allowed)                                                                | A chevron link (`Check-in ›`).                                    |
| `button_label`, `button_link`, `button_caption` | Text, Link (target-blank allowed), Text                                             | An outline button; `button_caption` is a free caption below it (e.g. `File Size: 504KB`). The button is disabled (greyed) if `button_link` has no link. |

A single block item can combine more than one of these (e.g. `text` + `image` on the same item) — they render in the fixed order above. Usually a block fills in only one purpose.

### Example: Case 1 — content, image, card, link, content, button

```json
[
  { "text": [{ "type": "paragraph", "content": { "text": "Some content", "spans": [] } }] },
  { "image": { "url": "https://images.prismic.io/…", "width": 800, "height": 600, "alt": "" } },
  { "card_heading": "Card title", "card_body": [{ "type": "paragraph", "content": { "text": "Card body", "spans": [] } }] },
  { "link_label": "Learn more", "link": { "url": "#" } },
  { "text": [{ "type": "paragraph", "content": { "text": "Some more content", "spans": [] } }] },
  { "button_label": "Download", "button_link": { "url": "#" } }
]
```

### Example: Case 2 — button, card, card, content, button, button, link

```json
[
  { "button_label": "Button 1", "button_link": { "url": "#" } },
  { "card_heading": "Card A", "card_body": [{ "type": "paragraph", "content": { "text": "…", "spans": [] } }] },
  { "card_heading": "Card B", "card_body": [{ "type": "paragraph", "content": { "text": "…", "spans": [] } }] },
  { "text": [{ "type": "paragraph", "content": { "text": "Some content", "spans": [] } }] },
  { "button_label": "Button 2", "button_link": { "url": "#" } },
  { "button_label": "Button 3", "button_link": { "url": "#" }, "button_caption": "File Size: 189KB" },
  { "link_label": "See details", "link": { "url": "#" } }
]
```

Both are just a reordered list of the same five block "shapes" — nothing else changes.

## Authoring tips

- **Line breaks:** in a rich-text paragraph, Shift+Enter inserts a line break, so two lines can sit together without the paragraph gap.
- **Roman-numeral lists:** Prismic rich text only has bullet and numbered lists. To get `i, ii, iii`, make a **numbered** list and apply the **`roman`** label (toolbar text style, like `muted`/`small`) to any one item in it — the whole list then uses Roman numerals. Available in `body`, `necessities`, and a block's `text`/`card_body`.
- **Placeholder links:** use `#` until the real destination exists (project convention).
- **Reordering `with_cards` instances** on the page reorders the visible topics — there's no shared numbering to break.

## Rendering & behavior

- Built on `Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` from `ui` (Radix underneath). The shared `ui` accordion is **not modified** — other apps use it.
- `type="multiple"`: any number of sections can be open. Every section starts **collapsed** unless its `start_expanded` is ticked. Users can toggle either way.
- **Numbering** (`default` only) comes from the array index, not Prismic — reordering items renumbers them.
- **Trigger row:** the whole row is clickable (pointer cursor). On hover the title turns green and underlines; the number does not.
- **Trigger icon:** Google Material Symbols `expand_circle_down` (green), rotated 180° when open. The slice hides the shared trigger's default chevrons and draws its own. The font is loaded by a `<link>` in `apps/frontend/app/[locale]/layout.tsx` (a CSS `@import` in `globals.css` doesn't work — Tailwind's generated rules must precede imports). **Any other app rendering this slice must load the same font**, otherwise the icon shows as the literal text "expand_circle_down".
- **Links** inside the panel (in-text hyperlinks, chevron links) are plain green, underline on hover, and don't change colour on hover.

### Border seam between stacked `with_cards` instances

Each `with_cards` instance renders its own bordered `AccordionItem`, matching the `default` variation's look. When two instances are direct DOM siblings (no other slice between them), a small CSS rule (`[&+&]:-mt-px` on the root) overlaps their borders into a single 1px line, the same as items sharing one `default` instance. It has no effect next to a different slice type — that boundary keeps its own border, which is correct (visually separating unrelated content).

## Files

| File            | Responsibility                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `index.tsx`     | Routes by `slice.variation`: renders the `default` numbered list, or delegates to `WithCards.tsx`.    |
| `WithCards.tsx` | One `with_cards` instance: trigger, note, body, `Blocks`, necessities, footnote, links.                |
| `cards.ts`      | Pure logic specific to this slice: `getOpenValues`, `itemValue`. Unit-tested in `cards.test.ts` (`pnpm test` in `packages/cms`). |
| `styles.ts`     | The long Tailwind class constants, each with the design measurement it came from.                     |
| `types.ts`      | `AccordionItem` (default variation) type.                                                              |

`Blocks.tsx`, `InfoBox.tsx`, `lists.tsx` (Roman-numeral lists) and the `blocks`-item type live in [`packages/cms/src/lib/content-blocks/`](../../lib/content-blocks/) — shared with [`FlexibleContent`](../FlexibleContent/README.md), the non-collapsible sibling slice that renders the exact same `blocks` field with no trigger. Don't duplicate that logic back into this folder; both slices' `blocks` Groups must stay field-for-field identical for the shared types to keep working.

## Styling conventions

Values were measured from the source design (ZIPAIR Boarding Process / Special Assistance) in browser DevTools. Trigger/panel/necessities styles live in this folder's `styles.ts`; the box and card styles live in [`lib/content-blocks/`](../../lib/content-blocks/).

- Built from `ui` primitives (`Card`, `Button`, `ChevronLink`), not other slices — see [Composing a slice](../README.md#composing-a-slice-use-ui-primitives-never-other-slices).
- **Colours** are theme tokens defined in `apps/frontend/app/globals.css`: `bg-surface-muted` (`#f4f7f6`) for boxes and cards, `text-ink` (`#100d0d`) for body text and titles, `text-primary` for numbers, icon and links.
- **Trigger row:** `py-5` (20px) around a 24px line, 16px bold title, 10px gap between number and title.
- **Panel:** padding `7px 0 48px`, 16px / 24px text, paragraphs `margin: 16px 0 0`.
- **`note` box:** grey `InfoBox`, padding `28px 32px`, `margin-bottom: 29px`, bold 24px line.
- **Cards (in `blocks`):** grey `InfoBox`, padding `28px 32px`, `margin-top: 16px`; heading 18px regular (24px line, 12px gap below); text and lists 12px / 18px.
- **Buttons (in `blocks`):** max 320px wide, white background with a green outline; the caption is 12px, left-aligned.
- **`necessities`:** small bold 12px label (`margin-top: 44px`, 12px gap below) above an outlined `InfoBox`; `heading4` bold with a 24px line, text 12px / 18px, 26px between groups.
- **Footnote:** 12px / 18px muted text, 24px above.
- **Trailing links:** `ChevronLink` with `w-fit pt-2 mb-0` — `w-fit` keeps the hover/click area to the text, not the full row.
- shadcn's default `AccordionItem` border classes are overridden (`border-t! border-b! last:border-b!`) — see [border seam](#border-seam-between-stacked-with_cards-instances) for how adjacent `with_cards` instances still show one divider.

## Migrating from DisclosureList

`DisclosureList` (one slice per topic) was merged into this slice and removed, first into `default`'s `items.cards` (a rich-text-with-heading-markers design), then reworked into `with_cards`'s `blocks` Group described above. Mapping from the original `DisclosureList`:

| DisclosureList field       | `with_cards` equivalent                                                        |
| --------------------------- | --------------------------------------------------------------------------------- |
| `title`, `body`             | `title`, `body` (one `with_cards` instance per former slice)                       |
| `box_heading` + `box_body`  | one block: `card_heading` + `card_body`                                            |
| `files` group                | one block per file: `button_label`, `button_link`, `button_caption` (file size)   |
| `link_label`, `link`        | `link_label`, `link`                                                              |

## Known limitations

- **Expanded-by-default is per instance/item** — there's no single "expand all" switch on the slice zone.
- **A block combines its fields in a fixed order** (text, image, card, link, button) — you can't, say, put a button above the card text within one block; use two blocks instead.
- **Icon font dependency** — the Material Symbols font must be loaded by the host app (see Rendering & behavior). There is no inline fallback.
- **`with_cards` instances stacked together rely on the border-seam CSS** to look like one continuous list; visually verify after adding/removing an instance next to another.

## Related slices

- [`FlexibleContent`](../FlexibleContent/README.md) — the same `blocks` stream as `with_cards`, always visible (no trigger/collapse).
- [`InfoCardList`](../InfoCardList/README.md) — a stack of grey cards that doesn't collapse.
- [`LinkList`](../LinkList/README.md) — an unlimited list of chevron links, for more than the two trailing links here.
- [`FileDownloadList`](../FileDownloadList/README.md) — standalone downloads not tied to a collapsible section.
- [`FaqQuestionList`](../FaqQuestionList/README.md) `accordion` variation — single-item collapsible category block.
