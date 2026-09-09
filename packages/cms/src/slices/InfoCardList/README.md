# InfoCardList

A stack of bordered info cards, each with a title and rich-text body — the repeating-list sibling of [`Callout`](../Callout/README.md).

**Live examples**: `special-assistance` (Chat and Email Inquiries / Phone Inquiries cards).

## When to use

- A list of N related, self-contained blocks — categories, contact methods, plan tiers — each needing a title and some body text/bullets.
- ZIPAIR reference pages: "Booking Age Category" boxes (Adult/Child A/B/C/Infant) and "Summary of fares" boxes (ZIP Full-Flat/Standard/U6 Standard) both map onto this slice — see the analysis referenced in project history for that page.

## When NOT to use

- Exactly one box, with a style variant (Info/Warning/Success/Neutral tint) → [`Callout`](../Callout/README.md).

## Variation: `default`

No primary fields.

### Item fields

| Field   | Type                                                                     | Required | Notes                                                                                   |
| ------- | ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `title` | Text                                                                     | No       | Card heading. Card renders without a header at all if left blank.                       |
| `body`  | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`) | No       | Card content — supports bullet/numbered lists, useful for eligibility-rule-style cards. |

### Example content

```json
{
  "items": [
    {
      "title": "Adult (15 years and older)",
      "body": [
        {
          "type": "list-item",
          "content": { "text": "They can travel alone.", "spans": [] }
        }
      ]
    },
    {
      "title": "Child A (12-14 years old)",
      "body": [
        {
          "type": "list-item",
          "content": { "text": "They cannot travel alone.", "spans": [] }
        },
        {
          "type": "list-item",
          "content": {
            "text": "They must be accompanied by another customer aged 15 or older.",
            "spans": []
          }
        }
      ]
    }
  ]
}
```

## Rendering & behavior

- Built on shadcn's `Card`/`CardHeader`/`CardTitle`/`CardContent` (`ui`) — one `Card` per item.
- `CardHeader`/`CardTitle` only render if `item.title` is set.

## Styling conventions

- `bg-muted` on every card (no style-variant system, unlike `Callout`).
- Body: `[&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:pl-5 [&_ul]:leading-relaxed [&_ol]:mb-2 [&_ol]:pl-5 [&_ol]:leading-relaxed`.
- Container: `flex flex-col gap-4 mt-6`.

## Known limitations

- No style-variant support (every card looks the same) — if a design needs, e.g., one card visually flagged as "most popular," this slice would need a per-item style field like `Callout`'s.
- No two-column/grid layout option — always a vertical stack.

## Related slices

- [`Callout`](../Callout/README.md) — same `Card` primitive, single box with style variants instead of a repeating list.
