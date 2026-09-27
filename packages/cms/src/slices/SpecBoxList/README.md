# SpecBoxList

A stack of bordered **definition-list boxes** — each item is one box, its rows a sequence of bold label → value pairs. Built for pages like a fare rule table: several named boxes, each a small spec sheet (Set Route, Seat, Refund, …).

**Live examples**: none yet — modelled on ZIPAIR's Fare Rule Table page.

## When to use

- A page shows several named boxes, each listing a fixed set of labelled facts (a route, a fee, a policy) — not free-flowing prose.
- The same box shape repeats several times on the page with different values (e.g. one box per fare type).

## When NOT to use

- The content is prose with occasional bold labels → [`RichTextSection`](../RichTextSection/README.md) or [`FlexibleContent`](../FlexibleContent/README.md).
- Each box needs mixed content (images, buttons, links) rather than plain label/value rows → `FlexibleContent`'s card blocks.
- The label and value belong on **one line**, value right-aligned (e.g. "Narita Departure ⋯⋯⋯ Available") — that's a different visual pattern this slice doesn't cover; ask before assuming it fits.

## Variation: `default`

### Item fields (repeatable `items`)

| Field       | Type                                                                                          | Required | Notes                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `label`     | Text                                                                                            | No       | Small bold caption shown above the box (e.g. "Standard Value, U6 Standard Value").                          |
| `anchor_id` | Text                                                                                            | No       | Wraps the item in `<div id="…">`, for in-page jump links (e.g. a [`LinkList`](../LinkList/README.md) slice above with hrefs like `#standard-value`). |
| `rows`      | Rich Text (`heading4,paragraph,strong,em,hyperlink,list-item,o-list-item`)                       | No       | **Every Heading 4 is a row label**; the paragraphs/bullets after it, until the next Heading 4, are its value. |

## Authoring tips

- **A row with a multi-part value** (e.g. Refund's "Before Flight Departure" / "After the Flight Departs" breakdown): put a bold paragraph as a sub-label, then its bullets, all still under the same Heading 4 — it's one row's value, just with internal structure.
- **Jump links**: give each box an `anchor_id` (e.g. `standard-value`), then add a `LinkList` slice above with a link to `#standard-value`.

### Example: one box

```json
{
  "label": "Standard Value, U6 Standard Value",
  "anchor_id": "standard-value",
  "rows": [
    { "type": "heading4", "content": { "text": "Set Route", "spans": [] } },
    { "type": "paragraph", "content": { "text": "Tokyo⇄Taipei, Bangkok, Singapore, Kuala Lumpur, Honolulu, Vancouver, San Francisco, San Jose, Los Angeles, Houston, Orlando", "spans": [] } },
    { "type": "heading4", "content": { "text": "Refund", "spans": [] } },
    { "type": "paragraph", "content": { "text": "Non-refundable.", "spans": [] } },
    { "type": "paragraph", "content": { "text": "The fee or tax that the company collects from each customer to pay the airport or tax authorities. If the customer does not travel and the company does not have to pay that amount, it will be refunded.", "spans": [] } }
  ]
}
```

## Rendering & behavior

- Box: [`InfoBox`](../../lib/content-blocks/InfoBox.tsx) `outline` variant (white, bordered) with [`definitionRowsClass`](../../lib/content-blocks/styles.ts) — the **same row styling as Accordion's `necessities` field** (bold 24px-line label, 12px/18px value text, 26px between rows). One place to change either.
- The `label` caption sits above the box, not inside it — plain 12px bold text.
- No collapsing, no trigger — every box is always visible.

## Known limitations

- Only the stacked label-above-value row style; the inline label…value-on-the-right style (seen on other ZIPAIR pages, e.g. route availability) is a different visual pattern and isn't covered here.
- `rows` is one rich-text field per box — Prismic can't nest a Group inside `items`, so rows can't be individually structured fields (label/value pairs); the Heading-4-starts-a-row convention is the workaround (same trade-off as Accordion's `necessities` and `cards`/`blocks`).

## Related slices

- [`Accordion`](../Accordion/README.md) — its `necessities` field uses the identical row convention and shares the same `definitionRowsClass` styling.
- [`InfoCardList`](../InfoCardList/README.md) — plain title + prose body cards, no label/value rows.
- [`LinkList`](../LinkList/README.md) — pair with this slice for the in-page jump-links pattern.
