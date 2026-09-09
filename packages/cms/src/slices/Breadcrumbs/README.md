# Breadcrumbs

The `Home › Level 1 › Level 2 › Level 3` trail at the top of a page.

**Live examples**: every page (`special-assistance`, `boarding-process`, `faq`, `network-and-timetable`, `payment`, `where-does-zipair-fly-to`) — always the second slice in the Heading zone, after `PageTitle`... actually before it in document order (`PageTitle` then `Breadcrumbs`, or vice versa — order in the Heading zone controls stacking order on the page).

## ⚠️ Important: this slice does not hold the breadcrumb text

Unlike every other slice, **the actual crumb labels/links are not slice fields**. They come from four **top-level fields on the `content_page` document itself** (Heading tab):

| Document field                                         | Purpose                 |
| ------------------------------------------------------ | ----------------------- |
| `breadcrumb_level_1_label` / `breadcrumb_level_1_href` | First crumb after Home. |
| `breadcrumb_level_2_label` / `breadcrumb_level_2_href` | Second crumb.           |
| `breadcrumb_level_3_label` / `breadcrumb_level_3_href` | Third crumb.            |

`app/[uid]/page.tsx` reads these four document fields and threads them into every slice on the page as `context.breadcrumbs` (see `PageContext` in `slices/index.ts`). The `Breadcrumbs` component reads `context.breadcrumbs`, not `slice.primary`/`slice.items`.

**Practical effect**: to change what a page's breadcrumb trail says, edit the document's `breadcrumb_level_*` fields directly — do **not** look for the text inside the `Breadcrumbs` slice instance itself.

- A level with an empty `label` is skipped.
- A level with a `label` but empty `href` renders as the current, non-clickable crumb (`text-foreground`, no link) — used for the last/current page.
- A level with both `label` and `href` renders as a link.

## When to use

Once per page, in the Heading zone. There's no reason to have more than one.

## Variation: `default`

### Primary fields

| Field       | Type | Required | Notes                                                                                                                                |
| ----------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `separator` | Text | No       | **Defined in the schema but not currently read by the component** — see [Known limitations](#known-limitations). Placeholder is `/`. |

No item fields.

### Example content

```json
{ "separator": "/" }
```

(The value doesn't currently affect rendering — see below.)

## Rendering & behavior

- Renders a Home icon link (`/`) first, always.
- Filters `context.breadcrumbs` to only entries with a non-empty `label`; returns `null` (renders nothing) if none are set.
- A chevron-right icon (hardcoded SVG, not driven by the `separator` field) separates every crumb including after Home.

## Styling conventions

- Home icon and linked crumbs: `text-primary` / `text-muted-foreground` with `hover:text-primary`.
- Current (non-linked, last) crumb: `text-foreground`.
- Chevron: `text-muted-foreground`.

## Known limitations

- **The `separator` primary field is unused.** The component always renders a fixed chevron icon between crumbs regardless of this field's value. Either wire it up (e.g. render it as literal text between crumbs when set) or remove it from the model — flagged here rather than silently left as dead schema.
- Breadcrumb depth is fixed at 3 levels (matching the document's 3 `breadcrumb_level_*` field pairs). A deeper hierarchy would need a new document field pair plus a `context.breadcrumbs` entry in `app/[uid]/page.tsx`.

## Related slices

- [`PageTitle`](../PageTitle/README.md) — typically placed alongside this in the Heading zone.
