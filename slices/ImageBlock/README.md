# ImageBlock

A single image with an optional caption.

**Live examples**: none currently authored on a live page.

## When to use

- A standalone image within the flow of a page's Main content, with an optional caption line.

## When NOT to use

- The image is part of a hero/banner treatment with overlaid text → [`HeroBanner`](../HeroBanner/README.md) (though note that slice currently needs a design pass — see its README).

## Variation: `default`

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | Image | Yes (in practice) | If empty, the whole slice renders nothing (`isFilled.image` guard). |
| `caption` | Text | No | Rendered as a `<figcaption>` below the image, only if set. |

No item fields.

### Example content

```json
{
  "image": { "url": "https://images.prismic.io/.../cabin.jpg", "alt": "Cabin interior" },
  "caption": "ZIP Full-Flat seating"
}
```

## Rendering & behavior

- `PrismicNextImage` for Next.js image optimization.
- Wrapped in a semantic `<figure>`/`<figcaption>` pair.

## Styling conventions

- `my-8` vertical spacing, `w-full h-auto rounded-md` on the image, `mt-2 text-sm text-muted-foreground` on the caption.

## Known limitations

- No alignment/width variant (always full-width of its container) — if a design needs a smaller inline image, this slice would need a new variation or a size field.

## Related slices

- [`HeroBanner`](../HeroBanner/README.md) — image + title + CTA, for a banner treatment (currently unstyled, needs design).
