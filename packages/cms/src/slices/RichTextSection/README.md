# RichTextSection

A heading + body rich-text block, with independent font-size/font-color controls at both the whole-block level and per-line (via repeatable items) — the most flexible plain-text slice in the library.

**Live examples**: `where-does-zipair-fly-to` (answer body), `faq` (Inquiries intro, Chat Inquiries, Inquiries by Email sections — 5 instances on one page).

## When to use

- A heading + paragraph(s) of body copy, optionally with inline bold/italic/links/lists.
- Content needing fine-grained typographic control per line (e.g. a muted disclaimer line mixed with normal-weight lines) — via the repeatable `items` (each is its own size/color-controlled line), as an alternative/supplement to the single `body` field.

## Variation: `default`

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `heading` | Rich Text (single: `heading2,heading3`; labels: `underline`, `highlight`) | No | Section heading. |
| `body` | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`; labels: `small`, `large`, `muted`, `accent`, `highlight`) | No | Main content — this is where most content lives. |
| `font_size` | Select: `Small` \| `Medium` \| `Large` (default `Medium`) | No | Applies to `body` (and inherits down to `heading` unless overridden — see [Rendering & behavior](#rendering--behavior)). |
| `font_color` | Select: `Default` \| `Muted` \| `Accent` (default `Default`) | No | Same scope as `font_size`. |

### Item fields (repeatable "lines")

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | Rich Text (single: `paragraph,strong,em,hyperlink`) | No | One independent line of content. |
| `font_size` | Select: `Small` \| `Medium` \| `Large` | No | Per-line override, independent of the primary-level `font_size`. |
| `font_color` | Select: `Default` \| `Muted` \| `Accent` | No | Per-line override. |

Use `items` when you need several lines with *different* size/color combinations in one slice instance (e.g. `faq`'s "Inquiry Hours" content mixes a heading line with detail lines) — otherwise just use `body`.

### Example content

```json
{
  "primary": {
    "heading": [{ "type": "heading3", "content": { "text": "Chat Inquiries", "spans": [] } }],
    "body": [
      {
        "type": "paragraph",
        "content": {
          "text": "You can chat with either an AI or a staff member.",
          "spans": [{ "type": "label", "start": 0, "end": 51, "data": "muted" }]
        }
      }
    ],
    "font_size": "Medium",
    "font_color": "Default"
  },
  "items": []
}
```

## Rendering & behavior

- `sizeClasses`/`colorClasses` lookup maps (`Small`→`text-sm`, `Muted`→`text-muted-foreground`, etc.) are applied to the wrapping `<section>` for the primary-level content, and to each per-line `<div>` for `items`. Because CSS `font-size`/`color` inherit, a heading without its own override still gets the section's size/color unless an explicit `[&_h2]:text-xl` (etc.) override wins — which it does, since headings have fixed styling baked into the descendant-selector classes (see next point).
- The shared [`richTextLabelComponents`](../../lib/rich-text-components.tsx) serializer maps Prismic's inline toolbar labels to Tailwind classes: `underline`→`underline`, `small`→`text-[0.875em]`, `large`→`text-[1.125em]`, `muted`→`text-muted-foreground`, `accent`→`text-primary`, `highlight`→`rounded-sm bg-[#fff3b0] px-0.5 py-px`. This is the mechanism content editors use to style a *span* of text differently from the rest of a paragraph (as opposed to `font_size`/`font_color`, which apply to the whole block/line). `Accordion`'s `body`/`necessities` fields also use this serializer — any new field with a `labels` config should too, or the labels silently render unstyled.
- Links inside rich text always render `text-primary` via `[&_a]:text-primary` on the wrapper — no separate link-color control.

## Styling conventions

- `[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3` (same for `h3`) and `[&_p]:mb-3 [&_p]:leading-relaxed` — the Tailwind v4 arbitrary-descendant-selector pattern used throughout this library for styling raw `PrismicRichText` output (see [slice library conventions](../README.md#conventions-used-across-every-slice)).

## Known limitations

- `font_size`/`font_color` at the primary level apply uniformly across `heading` + `body` + all list markers etc. within that scope (via CSS inheritance) — there's no way to give `heading` a different color from `body` except via inline `label` spans within the rich text itself.
- The `items` repeatable zone and the primary `body` field are independent — a slice instance can use either, both, or neither; there's no validation preventing an editor from filling both and getting more content than intended. Document this expectation when training content editors.

## Related slices

- [`PageTitle`](../PageTitle/README.md) — simpler, single-purpose H1 + subtitle (no font-size/color controls).
