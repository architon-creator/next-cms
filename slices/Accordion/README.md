# Accordion

Numbered, individually collapsible sections — for a step-by-step process where each step needs a title, some body copy, and optionally a highlighted callout, a "necessities" checklist, and up to two trailing links.

**Live examples**: Boarding Process (`boarding-process`).

## When to use

- The content is an ordered sequence of steps (numbered).
- Each step benefits from being collapsible, but all steps should be visible/expanded by default (this slice always starts fully open — see [Rendering & behavior](#rendering--behavior)).

## When NOT to use

- The sections aren't numbered / aren't a sequence → use [`DisclosureList`](../DisclosureList/README.md).
- You need more than two trailing links per item → use [`LinkList`](../LinkList/README.md) as a separate slice after this one, or split further.

## Variation: `default`

No primary fields — everything lives on repeatable `items`.

### Item fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | Text | Yes | The step's heading, shown next to its number. |
| `note` | Text | No | A single-line highlighted note rendered in a `bg-muted` box above the body (e.g. "From 3 hours to 1 hour before departure"). |
| `body` | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`; labels: `muted`, `small`) | No | Main step content. The `muted`/`small` toolbar labels are available for de-emphasizing inline text (e.g. an asterisked caveat) — rendered via the shared [`richTextLabelComponents`](../../lib/rich-text-components.tsx) serializer. |
| `necessities_heading` | Text | No | Heading above the "necessities" box (e.g. "Necessities"). Only rendered if `necessities` has content. |
| `necessities` | Rich Text (multi: `heading4,paragraph,strong,em,hyperlink`) | No | A bordered checklist box. Use `heading4` blocks as sub-item titles followed by a `paragraph` — see example. |
| `link_label` | Text | No | Label for the first trailing link. |
| `link` | Link (target-blank allowed) | No | First trailing link. Rendered as a chevron link only if filled. |
| `link2_label` | Text | No | Label for the second trailing link. |
| `link2` | Link (target-blank allowed) | No | Second trailing link. |

### Example content (one item)

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

- Built on shadcn's `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (`@/components/ui/accordion`, Radix underneath).
- `type="multiple"` with `defaultValue` set to **every** item's key — all sections start expanded. This is deliberate (matches the source designs, which showed every step visible), not the Radix default. Users can still individually collapse sections since it's a real accordion, not a static list.
- Item numbering (`1`, `2`, `3`...) is computed from array index, not stored in Prismic — reordering items in the dashboard automatically renumbers them.

## Styling conventions

- Number: `text-primary font-bold`. Title: `text-foreground font-bold`.
- `note` box: `bg-muted`. `necessities` box: plain `border`, with `heading4` styled `text-[0.95rem] font-bold` and its paragraphs `text-muted-foreground text-[0.9rem]`.
- Trailing links: shared [`ChevronLink`](../../components/ui/chevron-link.tsx) component (see [slice library conventions](../README.md#conventions-used-across-every-slice)).
- shadcn's default `AccordionItem` border classes are overridden (`border-t! border-b-0! last:border-b!`) to get one divider between items instead of Radix's default (which would double up with this slice's own top border).

## Known limitations

- No "collapsed by default" option — every item always starts open. If a future design needs mixed default-open/closed state, this would need a new primary/item field (cf. `FaqQuestionList`'s `accordion` variation's `current` field).

## Related slices

- [`DisclosureList`](../DisclosureList/README.md) — same collapsible pattern, unnumbered, single link.
- [`FaqQuestionList`](../FaqQuestionList/README.md) `accordion` variation — single-item collapsible category block.
