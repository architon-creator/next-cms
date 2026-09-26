# Accordion

Individually collapsible sections (numbered by default; set `hide_number` for plain titles) — for a step-by-step process where each step needs a title, some body copy, and optionally a highlighted callout, a "necessities" checklist, and up to two trailing links.

**Live examples**: Boarding Process (`boarding-process`).

## When to use

- The content is an ordered sequence of steps (numbered).
- Each step benefits from being collapsible, but all steps should be visible/expanded by default (this slice always starts fully open — see [Rendering & behavior](#rendering--behavior)).

## When NOT to use

- The sections aren't a sequence → still use this slice, and turn on `hide_number` to drop the `1, 2, 3…` numbers.
- You need more than two trailing links per item → use [`LinkList`](../LinkList/README.md) as a separate slice after this one, or split further.

## Variation: `default`

No primary fields — everything lives on repeatable `items`.

### Item fields

| Field                 | Type                                                                                               | Required | Notes                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`               | Text                                                                                               | Yes      | The step's heading, shown next to its number.                                                                                                                                                                                        |
| `note`                | Text                                                                                               | No       | A single-line highlighted note rendered in a `bg-muted` box above the body (e.g. "From 3 hours to 1 hour before departure").                                                                                                         |
| `body`                | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`; labels: `muted`, `small`) | No       | Main step content. The `muted`/`small` toolbar labels are available for de-emphasizing inline text (e.g. an asterisked caveat) — rendered via the shared [`richTextLabelComponents`](../../lib/rich-text-components.tsx) serializer. |
| `necessities_heading` | Text                                                                                               | No       | Heading above the "necessities" box (e.g. "Necessities"). Only rendered if `necessities` has content.                                                                                                                                |
| `necessities`         | Rich Text (multi: `heading4,paragraph,strong,em,hyperlink`)                                        | No       | A bordered checklist box. Use `heading4` blocks as sub-item titles followed by a `paragraph` — see example.                                                                                                                          |
| `link_label`          | Text                                                                                               | No       | Label for the first trailing link.                                                                                                                                                                                                   |
| `link`                | Link (target-blank allowed)                                                                        | No       | First trailing link. Rendered as a chevron link only if filled.                                                                                                                                                                      |
| `link2_label`         | Text                                                                                               | No       | Label for the second trailing link.                                                                                                                                                                                                  |
| `link2`               | Link (target-blank allowed)                                                                        | No       | Second trailing link.                                                                                                                                                                                                                |

### Primary field

| Field         | Type    | Notes                                                                                                             |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `hide_number` | Boolean | Off by default → numbered `1, 2, 3…`. Turn on for plain titled sections (e.g. Special Assistance). Existing pages are unaffected. |

### Extra item fields (cards, downloads, footnote)

All flat — Prismic can't nest a Group inside `items` (see [Flat-slice limitation](../README.md#conventions-used-across-every-slice)).

| Field                                                                    | Type                                  | Notes                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cards`                                                                  | Rich Text (`heading4`, paragraph, lists, hyperlink, **image**) | Grey cards. **Every `heading4` starts a new card**; anything until the next `heading4` (paragraphs, lists, an image) goes inside it. Any number of cards. |
| `file_1_heading` / `file_2_heading` / `file_3_heading`                   | Text                                  | Optional bold sub-heading above that download button (e.g. "Canada-bound Service").                                                                                  |
| `file_N_label`, `file_N`, `file_N_size`                                  | Text, Link, Text                      | Outline download button + "File Size: …" caption. Up to 3 slots. The button is disabled if `file_N` has no link.                                                     |
| `footnote`                                                               | Rich Text (paragraph, strong, em, hyperlink; labels `muted`, `small`) | Small muted text after the downloads (e.g. `* Assistance and service dogs…`).                                                                                        |

Render order inside an item: `note` → `body` → `cards` → downloads → `necessities` → `footnote` → `link`/`link2`.

### Example: an unnumbered section with cards and a download

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

### Example content (one item)

```json
{
  "title": "Check-in",
  "note": "From 3 hours to 1 hour before departure (check-in may start earlier depending on the number of passengers).",
  "body": [
    {
      "type": "paragraph",
      "content": {
        "text": "Please check in at the check-in counter one hour before departure...",
        "spans": []
      }
    }
  ],
  "necessities_heading": "Necessities",
  "necessities": [
    { "type": "heading4", "content": { "text": "Itinerary", "spans": [] } },
    {
      "type": "paragraph",
      "content": {
        "text": "Present the printed paper or the electronic version sent by email.",
        "spans": []
      }
    }
  ],
  "link_label": "Check-in",
  "link": { "url": "#" }
}
```

## Rendering & behavior

- Built on shadcn's `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (`ui`, Radix underneath).
- `type="multiple"` with `defaultValue` set to **every** item's key — all sections start expanded. This is deliberate (matches the source designs, which showed every step visible), not the Radix default. Users can still individually collapse sections since it's a real accordion, not a static list.
- Item numbering (`1`, `2`, `3`...) is computed from array index, not stored in Prismic — reordering items in the dashboard automatically renumbers them.

## Styling conventions

Values below were measured from the source design (ZIPAIR Boarding Process) in browser DevTools.

- Built from `ui` primitives (`Card`, `CardContent`, `ChevronLink`), not other slices — see [Composing a slice](../README.md#composing-a-slice-use-ui-primitives-never-other-slices).
- Header row: `py-5` (20px) around a 24px line, 16px text. Number `text-primary font-bold`, title `text-foreground font-bold`. The item has no vertical padding of its own.
- Panel (`AccordionContent`): padding `7px 0 48px`, 16px text, `#100D0D`, 24px line height, paragraphs `margin: 16px 0 0`. Content is **not** indented under the number.
- `note` box: `Card` with `bg-[#F4F7F6]`, padding `28px 32px`, `margin-bottom: 29px`, bold 24px line.
- `necessities`: a small bold 12px label (`necessities_heading`, `margin-top: 44px`, 12px gap below) above a `Card` with a 1px `border`, padding `28px 32px`, no bottom margin. `heading4` is bold 24px-line, its paragraph 12px / 18px line, 26px between groups.
- Trailing links: shared [`ChevronLink`](../../../ui/src/chevron-link.tsx) with `pt-5 mb-0` (20px above, no margin).
- shadcn's default `AccordionItem` border classes are overridden (`border-t! border-b-0! last:border-b!`) to get one divider between items instead of Radix's default (which would double up with this slice's own top border).
- The two raw hex values (`#F4F7F6`, `#100D0D`) are deliberate off-palette design colours taken from the source design.

## Known limitations

- No "collapsed by default" option — every item always starts open. If a future design needs mixed default-open/closed state, this would need a new primary/item field (cf. `FaqQuestionList`'s `accordion` variation's `current` field).

## Related slices

- [`FaqQuestionList`](../FaqQuestionList/README.md) `accordion` variation — single-item collapsible category block.
