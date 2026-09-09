# ButtonLink

A single, centered button linking to another page or file, with optional left/right icon and a solid-vs-outline style choice.

**Live examples**: `where-does-zipair-fly-to` ("See Related Questions List"), `faq` ("Contact Form") — both authored before `style`/`icon_left`/`icon_right` existed, so they render as plain outline buttons (the fields' defaults/empty state matches the old hardcoded look, so nothing changed for them).

## When to use

- One clear, prominent call-to-action link, standalone (not inline with body text).
- You need exactly one button — for multiple stacked buttons with file-size captions, use [`FileDownloadList`](../FileDownloadList/README.md) instead (even for non-file links, if you need more than one button in a group, that's the closer-fitting slice's layout).
- Covers all 6 common button layout/color cases from a single variation: label-only, label + left icon, label + right icon, label + both icons, each in either solid or outline style — see [Rendering & behavior](#rendering--behavior).

## Variation: `default`

### Primary fields

| Field        | Type                                                                                                              | Required | Notes                                                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | Text                                                                                                              | Yes      | Button text.                                                                                                                                                                                             |
| `link`       | Link (target-blank allowed)                                                                                       | Yes      | If empty, the whole slice renders nothing (`isFilled.link` guard).                                                                                                                                       |
| `style`      | Select: `Solid` \| `Outline` (default `Outline`)                                                                  | No       | `Solid` → shadcn Button's `default` variant (filled `bg-primary`, white text). `Outline` → white background, green border/text (the original look, still the default so existing content is unaffected). |
| `icon_left`  | Select: `ArrowLeft` \| `ArrowRight` \| `ChevronLeft` \| `ChevronRight` \| `Download` \| `ExternalLink` \| `Check` | No       | Renders a `lucide-react` icon before the label. Leave unset for no left icon.                                                                                                                            |
| `icon_right` | Select: same options as `icon_left`                                                                               | No       | Renders a `lucide-react` icon after the label. Leave unset for no right icon.                                                                                                                            |

No item fields.

### Example content

```json
{
  "label": "Book Now",
  "link": { "url": "/reservations" },
  "style": "Solid",
  "icon_left": null,
  "icon_right": "ArrowRight"
}
```

## Rendering & behavior

- Built on shadcn's `Button` (`ui`) via `asChild`, wrapping `PrismicNextLink` — so the actual DOM node is an `<a>`, not a `<button>`, while getting Button's styling/variant system.
- `variant` is chosen from `style`: `"default"` (solid) when `style === "Solid"`, otherwise `"outline"`.
- `icon_left`/`icon_right` are looked up in a local `icons` map (`ArrowLeft`, `ArrowRight`, `ChevronLeft`, `ChevronRight`, `Download`, `ExternalLink`, `Check` from `lucide-react`) and rendered as siblings of the label text inside the link. Each icon carries `data-icon="inline-start"`/`"inline-end"` — shadcn's Button CSS reads that attribute to tighten the padding on that side (`has-data-[icon=inline-start]:pl-2` etc.), so icons don't need manual margin.
- To add a new icon option: add it to both `icon_left`/`icon_right`'s `options` array in `model.json` and the `icons` map in `index.tsx` (import it from `lucide-react`, which is already a project dependency).
- Wrapped in a `flex justify-center` container to center it on the page.

## Styling conventions

- Outline style keeps the original override classes: `border-primary! text-primary!` (the `!` forces these to win over the component's own Tailwind classes — see [slice library conventions](../README.md)) and `hover:bg-accent!` for the hover state.
- Solid style relies on Button's own `default` variant classes (`bg-primary text-primary-foreground hover:bg-primary/80`) with no color overrides needed, since the theme's `--primary` token is already the brand green.
- Both styles share `h-auto! px-8 py-3 font-semibold` — Button's default fixed height (`h-8`) is overridden for a larger, more prominent CTA size.

## Known limitations

- Icon choices are a fixed Select list, not a free icon picker — adding a new icon requires a code change (see above), not just a content edit.
- No "icon only, no label" case — `label` is always required for the slice to render (by design, this slice's `link` guard doesn't cover a label-less button; an icon-only button would need its own slice/variation).

## Related slices

- [`FileDownloadList`](../FileDownloadList/README.md) — multiple outline buttons with a file-size caption each.
- [`LinkList`](../LinkList/README.md) — for a set of plain (non-button) chevron links instead.
