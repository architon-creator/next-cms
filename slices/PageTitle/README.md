# PageTitle

The page's H1 and an optional subtitle. Belongs in the Heading zone, once per page.

**Live examples**: every page.

## When to use

Once per page, in the Heading zone, alongside [`Breadcrumbs`](../Breadcrumbs/README.md).

## Variation: `default`

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | Rich Text (single: `heading1`) | Yes | The page's H1. |
| `subtitle` | Text | No | Rendered as a `<p>` below the title, only if set. |

No item fields.

### Example content

```json
{
  "title": [{ "type": "heading1", "content": { "text": "Boarding Process", "spans": [] } }],
  "subtitle": ""
}
```

## Rendering & behavior

- Custom `heading1` serializer (`components` prop on `PrismicRichText`) applies the styled classes directly to the `<h1>` — necessary because `PrismicRichText` renders the raw tag and can't take a `className` prop otherwise (see [slice library conventions](../README.md#conventions-used-across-every-slice) on rich-text styling).

## Styling conventions

- `mb-2 text-4xl font-semibold` on the H1.
- `text-muted-foreground` on the subtitle.
- `mt-4` on the wrapping `<section>`.

## Known limitations

- None — small, stable slice.

## Related slices

- [`Breadcrumbs`](../Breadcrumbs/README.md) — typically the other Heading-zone slice on the same page.
