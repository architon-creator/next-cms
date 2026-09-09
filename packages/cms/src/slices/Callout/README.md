# Callout

A bordered, colored box for a multi-line note, warning, or highlighted block.

**Live examples**: `special-assistance` ("【Special Assistance】" box), `faq` ("Inquiry Hours" box).

## When to use

- A single, standalone highlighted message — a warning, an important note, a success confirmation — that should visually stand apart from surrounding body copy.
- Content is a heading (optional) + rich text body (paragraphs, bold/italic, links, lists).

## When NOT to use

- A repeating list of cards → use [`InfoCardList`](../InfoCardList/README.md) instead (same visual building block — shadcn `Card` — but for N items, not one).

## Variation: `default`

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `style` | Select: `Neutral` \| `Info` \| `Warning` \| `Success` | No (defaults to `Neutral`) | Controls background/border tint — see [Styling conventions](#styling-conventions). |
| `heading` | Rich Text (single: `heading3,heading4`) | No | Rendered inside a `CardTitle`; omitted entirely (no empty header) if left blank. |
| `body` | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`) | No | Main content. |

No item fields.

### Example content

```json
{
  "style": "Neutral",
  "heading": [{ "type": "heading3", "content": { "text": "【Special Assistance】", "spans": [] } }],
  "body": [
    { "type": "paragraph", "content": { "text": "If you require support for a wheelchair...", "spans": [] } },
    { "type": "list-item", "content": { "text": "Booking Number", "spans": [] } }
  ]
}
```

## Rendering & behavior

- Built on shadcn's `Card`/`CardHeader`/`CardTitle`/`CardContent` (`@/components/ui/card`).
- `heading` only renders (with its `CardHeader`) if `isFilled.richText(slice.primary.heading)` — an empty heading doesn't leave a blank header bar.

## Styling conventions

- Style-to-class lookup (`styleClasses` in `index.tsx`):

  | `style` | Classes |
  |---|---|
  | `Neutral` | `bg-muted border-border` |
  | `Info` | `bg-[#eaf6f3] border-primary` |
  | `Warning` | `bg-[#fff8e6] border-[#e0a300]` |
  | `Success` | `bg-[#eaf8ee] border-[#2e9e4f]` |

  The `Info`/`Warning`/`Success` tints are deliberately off-palette (not `bg-primary`/design tokens) — they're semantic status colors, not brand colors, and don't have a corresponding token in `app/globals.css`.
- `CardTitle` font size overridden to `text-[1.05rem]` (smaller than shadcn's default `Card` title size).
- Body paragraphs: `[&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed`.

## Known limitations

- Only 4 fixed style options; adding a 5th requires both a `model.json` Select-options edit (pushed to Prismic) and a `styleClasses` entry in code.

## Related slices

- [`InfoCardList`](../InfoCardList/README.md) — same `Card` building block, for a repeating list instead of one box, no style-variant support.
