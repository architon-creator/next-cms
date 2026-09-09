# LinkList

An optional heading followed by a vertical, unlimited-length list of chevron links — the general-purpose sibling to `Accordion`'s (max 2) and `DisclosureList`'s (max 1) trailing links.

**Live examples**: none authored yet — added for the "Reservations and fares" page's "How to Book" section (3 trailing links: "Changing and Cancelling Reservations", "About Payment", "To Customers Traveling on U.S. Bound Flights"), not yet built out.

## When to use

- A standalone list of related links following some body text, where the count could be anything (not capped at 1–2).
- Typically placed as its own slice instance directly after a [`RichTextSection`](../RichTextSection/README.md) that supplies the surrounding heading/body copy.

## When NOT to use

- The links are attached to a single collapsible section's content → use `Accordion`'s (`link`/`link2`) or `DisclosureList`'s (`link`) built-in fields instead, to keep the link visually inside that section's panel.
- You need each link to look like a button, not a plain chevron link → [`ButtonLink`](../ButtonLink/README.md) / [`FileDownloadList`](../FileDownloadList/README.md).

## Variation: `default`

### Primary fields

| Field     | Type                                              | Required | Notes                                                                                                                                                                                          |
| --------- | ------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` | Rich Text (single: `heading2,heading3,strong,em`) | No       | Optional section heading above the links. Omit if the preceding slice already supplies a heading (as in the "How to Book" use case, where a separate `RichTextSection` carries "How to Book"). |

### Item fields

| Field   | Type                        | Required          | Notes                                                                                                    |
| ------- | --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `label` | Text                        | Yes               | Link text.                                                                                               |
| `link`  | Link (target-blank allowed) | Yes (in practice) | Items with an empty link are silently skipped (`isFilled.link` guard) rather than rendered as dead text. |

### Example content

```json
{
  "primary": {},
  "items": [
    { "label": "Changing and Cancelling Reservations", "link": { "url": "#" } },
    { "label": "About Payment", "link": { "url": "/payment" } },
    { "label": "To Customers Traveling on U.S. Bound Flights", "link": { "url": "#" } }
  ]
}
```

## Rendering & behavior

- No collapsible behavior at all — this is a static list, not built on shadcn's `Accordion`. If a future design wants these links collapsed by default, that's a different slice (or a new variation here).
- `key` for each rendered link uses `${item.label}-${index}`; if two items share the exact same label, ensure they still get distinct React keys naturally via the index suffix (already handled).

## Styling conventions

- Uses the shared [`ChevronLink`](../../../ui/src/chevron-link.tsx) component (same one `Accordion`'s trailing links use, with its default `chevron={true}`): `font-semibold text-primary`, `after:content-['\203A']`, `mb-2 last:mb-0`.
- Optional heading uses the same `headingComponents` pattern as `FaqQuestionList` (`mb-3 text-xl font-semibold`).

## Known limitations

- None yet identified — this is a new, minimally-scoped slice built specifically to fill the ">2 trailing links" gap.

## Related slices

- [`Accordion`](../Accordion/README.md) — up to 2 trailing links, attached to a collapsible section.
- [`DisclosureList`](../DisclosureList/README.md) — 1 trailing link, attached to a collapsible section.
- [`ButtonLink`](../ButtonLink/README.md) — single prominent button instead of a plain link list.
