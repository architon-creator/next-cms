# Accordion

Individually collapsible sections. Numbered by default (a step-by-step process); turn on `hide_number` for plain titled sections. Each section can have a highlighted note, body text, grey cards, download buttons, a "necessities" box, a footnote and up to two trailing links.

**Live examples**: Boarding Process (`boarding-process`, numbered), Special Assistance (`special-assistance`, unnumbered, cards + downloads + footnotes).

This slice replaces the former `DisclosureList` slice (see [Migrating from DisclosureList](#migrating-from-disclosurelist)).

## When to use

- An ordered sequence of steps, each collapsible → leave `hide_number` off.
- A set of topics that each need a title, some text, and optionally cards, downloads and links → turn `hide_number` on.
- All sections should be visible/expanded by default (this slice always starts fully open — see [Rendering & behavior](#rendering--behavior)).

## When NOT to use

- More than two trailing links per section → put a [`LinkList`](../LinkList/README.md) slice after this one.
- A standalone list of cards that doesn't collapse → [`InfoCardList`](../InfoCardList/README.md).
- Downloads that aren't tied to a section → [`FileDownloadList`](../FileDownloadList/README.md).
- More than 3 downloads in one section, or downloads needing more than a heading per button → the flat-field model tops out at 3 (see [Known limitations](#known-limitations)).

## Variation: `default`

### Primary field

| Field         | Type    | Notes                                                                                                   |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `hide_number` | Boolean | Off (default) → numbered `1, 2, 3…`. On → plain titles. Existing numbered pages are unaffected.         |

### Item fields (repeatable `items`)

All item fields are flat — Prismic can't nest a Group inside an `items` zone (see the [flat-slice limitation](../README.md#conventions-used-across-every-slice)).

**Content**

| Field   | Type                                                                                              | Required | Notes                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title` | Text                                                                                              | Yes      | The section heading (next to its number, if numbered).                                                                                                 |
| `note`  | Text                                                                                              | No       | A single-line bold note in a grey box above the body (e.g. "From 3 hours to 1 hour before departure").                                                 |
| `body`  | Rich Text (`paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted`, `small`)        | No       | Main text. `muted`/`small` labels de-emphasise inline text via the shared [`richTextLabelComponents`](../../lib/rich-text-components.tsx) serializer.   |

**Cards and downloads**

| Field                                                | Type                                                                            | Notes                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cards`                                              | Rich Text (`heading4`, paragraph, strong, em, hyperlink, lists, **image**; labels `muted`, `small`) | Grey cards. **Every `heading4` starts a new card**; everything until the next `heading4` (paragraphs, lists, an image) goes inside it. Any number of cards.       |
| `downloads_card`                                     | Number                                                                          | Which card (1-based) holds the download buttons. Blank or out of range → the last card. With no cards, the downloads get a card of their own.                              |
| `file_1_heading` … `file_3_heading`                  | Text                                                                            | Optional bold sub-heading above that download button (e.g. "Canada-bound Service").                                                                                         |
| `file_N_label`, `file_N`, `file_N_size`              | Text, Link, Text                                                                | Outline button + "File Size: …" caption (left-aligned). Up to 3 slots. The button is disabled (greyed) if `file_N` has no link.                                             |
| `footnote`                                           | Rich Text (`paragraph,strong,em,hyperlink`; labels `muted`, `small`)            | Small muted text after the cards and downloads (e.g. `* Assistance and service dogs…`).                                                                                     |

**Necessities and links**

| Field                 | Type                                                        | Notes                                                                                                         |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `necessities_heading` | Text                                                        | Small bold label above the necessities box (e.g. "Necessities"). Only rendered if `necessities` has content.  |
| `necessities`         | Rich Text (`heading4,paragraph,strong,em,hyperlink`)        | A bordered (white) box. `heading4` = sub-item title, followed by a `paragraph`.                                |
| `link_label`, `link`  | Text, Link (target-blank allowed)                           | First trailing chevron link (`Check-in ›`). Rendered only if `link` is filled.                                 |
| `link2_label`, `link2`| Text, Link (target-blank allowed)                           | Second trailing chevron link.                                                                                  |

**Render order inside a section:** `note` → `body` → `cards` (downloads inside the chosen card) → `necessities_heading` + `necessities` → `footnote` → `link` → `link2`.

### Authoring tips

- **Line breaks:** in a rich-text paragraph, Shift+Enter inserts a line break (rendered as `<br>`), so two lines can sit together without the paragraph gap.
- **Cards:** start each card with a **Heading 4**. Content placed before the first Heading 4 becomes a card with no heading.
- **Downloads in a specific card:** set `downloads_card` to the card's position. If you later insert a card above it, update the number — it is a position, not a link to the card.
- **Placeholder links:** use `#` until the real destination exists (project convention).

### Example: an unnumbered section with a card and a download

```json
{
  "title": "Pregnant Customers",
  "body": [{ "type": "paragraph", "content": { "text": "Pregnant customers must confirm the following…", "spans": [] } }],
  "cards": [
    { "type": "heading4", "content": { "text": "Due Date", "spans": [] } },
    { "type": "paragraph", "content": { "text": "If you are within 28 days of your expected delivery date…", "spans": [] } }
  ],
  "file_1_label": "MEDICAL INFORMATION FORM (Questionnaire)",
  "file_1": { "url": "#" },
  "file_1_size": "504KB"
}
```

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

## Rendering & behavior

- Built on `Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` from `ui` (Radix underneath). The shared `ui` accordion is **not modified** — other apps use it.
- `type="multiple"` with every item open by default (matches the source designs). Users can still collapse sections individually.
- **Numbering** comes from the array index, not from Prismic — reordering items renumbers them.
- **Trigger row:** the whole row is clickable (pointer cursor). On hover the title turns green and underlines; the number does not.
- **Trigger icon:** Google Material Symbols `expand_circle_down` (green), rotated 180° when open. The slice hides the shared trigger's default chevrons and draws its own. The font is loaded by a `<link>` in `apps/frontend/app/[locale]/layout.tsx` (a CSS `@import` in `globals.css` doesn't work — Tailwind's generated rules must precede imports). **Any other app rendering this slice must load the same font**, otherwise the icon shows as the text "expand_circle_down".
- **Links** inside the panel (in-text hyperlinks and chevron links) are plain green, underline on hover, and don't change colour on hover.
- **Downloads** render inside a card; `downloads_card` picks which one.
- **"File Size" label:** not a Prismic field. Pages pass it via `SliceRenderer`'s `context.labels.fileSize` (the frontend sets it per locale in `apps/frontend/lib/slice-context.ts`); it falls back to English.

## Files

| File            | Responsibility                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `index.tsx`     | The slice: accordion shell, trigger (number, title, icon), note, necessities, footnote, links.        |
| `ItemBoxes.tsx` | The grey cards from `cards`, with the downloads inside the card chosen by `downloads_card`.           |
| `Downloads.tsx` | Download buttons with optional sub-headings and the "File Size" caption.                               |
| `InfoBox.tsx`   | The flat box (`fill` / `outline` variants) — the one place the box padding and colour are defined.    |
| `cards.ts`      | Pure logic: `splitCards`, `resolveDownloadsIndex`. Unit-tested in `cards.test.ts` (`pnpm test` in `packages/cms`). |
| `styles.ts`     | The long Tailwind class constants, each with the design measurement it came from.                     |
| `types.ts`      | The `AccordionItem` type.                                                                             |

## Styling conventions

Values were measured from the source design (ZIPAIR Boarding Process / Special Assistance) in browser DevTools. They live in `styles.ts` and `InfoBox.tsx`.

- Built from `ui` primitives (`Card`, `Button`, `ChevronLink`), not other slices — see [Composing a slice](../README.md#composing-a-slice-use-ui-primitives-never-other-slices).
- **Colours** are theme tokens defined in `apps/frontend/app/globals.css`: `bg-surface-muted` (`#f4f7f6`) for boxes and cards, `text-ink` (`#100d0d`) for body text and titles, `text-primary` for numbers, icon and links.
- **Trigger row:** `py-5` (20px) around a 24px line, 16px bold title, 10px gap between number and title. The item has no vertical padding of its own.
- **Panel:** padding `7px 0 48px`, 16px / 24px text, paragraphs `margin: 16px 0 0`. Content is not indented under the number.
- **`note` box:** grey `InfoBox`, padding `28px 32px`, `margin-bottom: 29px`, bold 24px line.
- **Cards:** grey `InfoBox`, padding `28px 32px`, `margin-top: 16px`; headings 18px regular (24px line, 12px gap below); text and lists 12px / 18px.
- **Downloads:** buttons max 320px wide, white background with a green outline; the size caption is 12px, left-aligned.
- **`necessities`:** small bold 12px label (`margin-top: 44px`, 12px gap below) above an outlined `InfoBox`; `heading4` bold with a 24px line, text 12px / 18px, 26px between groups.
- **Footnote:** 12px / 18px muted text, 24px above.
- **Trailing links:** `ChevronLink` with `w-fit pt-2 mb-0` — `w-fit` keeps the hover/click area to the text, not the full row.
- shadcn's default `AccordionItem` border classes are overridden (`border-t! border-b-0! last:border-b!`) for one divider between items.

## Migrating from DisclosureList

`DisclosureList` (one slice per topic) was merged into this slice and removed. Mapping:

| DisclosureList field         | Accordion equivalent                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `title`, `body`              | `title`, `body` (one Accordion item per former slice)                             |
| `box_heading` + `box_body`   | one card in `cards`: a `heading4` (the box heading) followed by the box body      |
| `files` group                | `file_1..3` (label, link, size) — max 3                                            |
| `link_label`, `link`         | `link_label`, `link`                                                              |

Set `hide_number` on, since `DisclosureList` was unnumbered. Many former slices can become items of a single Accordion slice.

## Known limitations

- **No "collapsed by default" option** — every item starts open. Mixed default-open/closed would need a new field (cf. `FaqQuestionList`'s `accordion` variation's `current` field).
- **Downloads are capped at 3 per section** — they are flat fields (`file_1..3`) because Prismic can't nest a Group inside `items`. A fourth would need four new fields.
- **`downloads_card` is a position**, not a link to a card: inserting or reordering cards can move the buttons into the wrong card.
- **Cards are rich text**, so they can hold text, lists and images only — no buttons or other components (downloads are separate fields).
- **Icon font dependency** — the Material Symbols font must be loaded by the host app (see Rendering & behavior). There is no inline fallback.
- **Wide editor form** — the item has many optional fields; only the ones a section needs should be filled.

## Related slices

- [`InfoCardList`](../InfoCardList/README.md) — a stack of grey cards that doesn't collapse.
- [`LinkList`](../LinkList/README.md) — an unlimited list of chevron links, for more than the two trailing links here.
- [`FileDownloadList`](../FileDownloadList/README.md) — standalone downloads not tied to a collapsible section.
- [`FaqQuestionList`](../FaqQuestionList/README.md) `accordion` variation — single-item collapsible category block.
