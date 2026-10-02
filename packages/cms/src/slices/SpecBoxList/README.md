# SpecBoxList

A stack of **2-column definition tables** — each item is one table: a shaded label column on the left, a value column on the right, with a divider between rows. Built for pages like a fare rule table: several named tables, each a small spec sheet (Set Route, Seat, Refund, …).

**Live examples**: none yet — modelled on ZIPAIR's Fare Rule Table page.

## When to use

- A page shows several named tables, each listing a fixed set of labelled facts (a route, a fee, a policy) — not free-flowing prose.
- The same table shape repeats several times on the page with different values (e.g. one table per fare type).

## When NOT to use

- The content is prose with occasional bold labels → [`RichTextSection`](../RichTextSection/README.md) or [`FlexibleContent`](../FlexibleContent/README.md).
- Each entry needs mixed content (images, buttons, links) rather than plain label/value rows → `FlexibleContent`'s card blocks.
- A stacked (not side-by-side) bold-label-then-text box, with no row dividers or shaded column — that's [`Accordion`](../Accordion/README.md)'s `necessities` field, a different look. Don't assume the two are interchangeable; they were built from different designs (confirmed by comparing rendered output against the source screenshot — the two only look similar in a rough description, not in practice).

## Variation: `default`

### Item fields (repeatable `items`)

| Field       | Type                                                                                          | Required | Notes                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `label`     | Text                                                                                            | No       | Small bold caption shown above the table (e.g. "Standard Value, U6 Standard Value").                          |
| `anchor_id` | Text                                                                                            | No       | Wraps the item in `<div id="…">`, for in-page jump links (e.g. a [`LinkList`](../LinkList/README.md) slice above with hrefs like `#standard-value`). |
| `rows`      | Rich Text (`heading4,paragraph,strong,em,hyperlink,list-item,o-list-item`)                       | No       | **Every Heading 4 is a row label**; the paragraphs/bullets after it, until the next Heading 4, are its value — split into label/value pairs by [`lib/content-blocks/rows.ts`](../../lib/content-blocks/rows.ts), then rendered as an actual 2-column grid row (not just styled inline). |

## Authoring tips

- **A row with a multi-part value** (e.g. Refund's "Before Flight Departure" / "After the Flight Departs" breakdown): put a bold paragraph as a sub-label, then its bullets, all still under the same Heading 4 — it's one row's value, just with internal structure.
- **Jump links**: give each table an `anchor_id` (e.g. `standard-value`), then add a `LinkList` slice above with a link to `#standard-value`.

### Example: one table

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

- [`lib/content-blocks/rows.ts`](../../lib/content-blocks/rows.ts)'s `splitRows` turns the flat rich-text field into `{ label, value }` pairs (unit-tested in `rows.test.ts`, `pnpm test` in `packages/cms`) — shared with `BoardingProcessStep`'s `info_card` blocks, same split logic.
- Each row renders as `grid grid-cols-[140px_1fr]`: a `bg-muted` bold label cell on the left, the value's rich text on the right, `border-b` between rows (the last row has none), the whole table `border rounded overflow-hidden`.
- The `label` caption sits above the table, not inside it — plain 12px bold text.
- No collapsing, no trigger — every table is always visible.
- The `140px` label-column width and the value text's muted colour are a visual approximation from a design screenshot, not measured in browser DevTools — adjust if a closer look shows different numbers.

## Known limitations

- Only this stacked-rows-as-a-table style; the inline label…value-on-the-right style (seen on other ZIPAIR pages, e.g. route availability) is a different visual pattern and isn't covered here.
- `rows` is one rich-text field per table — Prismic can't nest a Group inside `items`, so rows can't be individually structured fields (label/value pairs); the Heading-4-starts-a-row convention is the workaround (same trade-off as Accordion's `necessities` and `cards`/`blocks`).
- The label column is a **fixed** 140px — a very long label wraps to multiple lines rather than the column growing.

## Related slices

- [`Accordion`](../Accordion/README.md) — its `necessities` field uses the same Heading-4-starts-a-row *content* convention, but renders as a stacked box, not a table; the two fields are not visually interchangeable.
- [`InfoCardList`](../InfoCardList/README.md) — plain title + prose body cards, no label/value rows.
- [`LinkList`](../LinkList/README.md) — pair with this slice for the in-page jump-links pattern.
