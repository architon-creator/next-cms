# FaqQuestionList

The FAQ system's workhorse slice — five variations covering every layout the FAQ level-1/2/3 pages need: a plain question list, an inline topic-link row, a collapsible category (for the sidebar), a static category tile that turns into a mobile accordion (for the footer), and an unused fifth variation. **Read the variation table below carefully — the right one depends entirely on where in the page the slice sits.**

**Live examples**: `faq` (level-1 hub — `grid` in Main), `network-and-timetable` / `payment` / `where-does-zipair-fly-to` (level-2/3 — `default` in Main, `accordion` ×6 in Aside, `footer_grid` ×6 in Footer).

## Variation quick-reference

| Variation | Zone it belongs in | Shape | Collapsible? |
|---|---|---|---|
| `default` | Main | One category's question list (chevron nav rows) | No |
| `grid` | Main (level-1 hub only) | Category heading + inline-wrapped topic links | No |
| `accordion` | Aside | One category, collapsed/expanded per the `current` field | Yes (desktop and mobile) |
| `footer_grid` | Footer | One category tile in a 4-column grid | No on `sm:`+, yes (mobile-only) below `sm:` |
| `withicon` | — | **Not implemented** — see [Known limitations](#known-limitations) | — |

Because `accordion` and `footer_grid` each represent **one category**, a page with 6 categories needs **6 slice instances** of that variation, stacked in the same zone (Prismic can't nest a repeatable "questions" group inside a repeatable "categories" group — see the [slice library conventions](../README.md#conventions-used-across-every-slice)).

---

## Variation: `default`

The question list for whichever category the current level-2/3 page belongs to.

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `heading` | Rich Text (single: `heading2,heading3,strong,em`) | No | Rendered above the list if set; usually left blank since the page's `PageTitle` already carries this. |
| `description` | Rich Text (multi) | No | Rendered below `heading`, above the list. |
| `number` | Number | No | **Unused legacy field** — not read by the component. |
| `text` | Text | No | **Unused legacy field** — not read by the component. |

### Item fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `question` | Text | Yes | The row's label. |
| `href` | Text (plain string) | No | If set, the row is a link; otherwise a static row. |

### Example content

```json
{
  "items": [
    { "question": "Where does ZIPAIR fly to?", "href": "/where-does-zipair-fly-to" },
    { "question": "Where can I check the flight status?", "href": "#" }
  ]
}
```

### Rendering

Each row: label + a right-pointing chevron icon, `hover:bg-accent` when it's a link. No numbering (dropped in favor of matching the reference design, which showed plain chevron rows). Rendered with `next/link`'s `Link` (not a raw `<a>`) so navigating between question pages is a client-side transition, not a full browser reload — see [Navigation note](#navigation-note-all-href-links-in-this-slice) below.

---

## Variation: `grid`

The level-1 FAQ hub's per-category block: a bold heading followed by all of that category's topics as a flowing, wrapped row of plain underlined links — not a vertical list.

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `heading` | Rich Text (single: `heading2,heading3,strong,em`) | Yes (in practice) | Category name, e.g. "About Reservations". |
| `description` | Rich Text (multi) | No | Not rendered in the current markup — model carries it for parity with other variations, but the `grid` render branch never reads it. |

### Item fields

Same as `default` (`question`, `href`).

### Example content

```json
{
  "primary": { "heading": [{ "type": "heading3", "content": { "text": "About Reservations", "spans": [] } }] },
  "items": [
    { "question": "Network and Timetable", "href": "/network-and-timetable" },
    { "question": "Booking", "href": "#" }
  ]
}
```

### Rendering

`flex flex-wrap gap-x-6 gap-y-2` — links wrap naturally across lines, `text-primary underline`.

---

## Variation: `accordion`

One collapsible category, for the level-2/3 pages' Aside sidebar. Six of these (one per category) stack in the Aside zone.

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `heading` | Rich Text (single: `heading2,heading3,strong,em`) | Yes | Category name. |
| `current` | Boolean | No (defaults false) | `true` on the category matching the page you're viewing — makes it start expanded. All other instances on the same page should be `false`. |

### Item fields

Same as `default` (`question`, `href`) — each item is one topic link inside this category.

### Example content

```json
{
  "primary": {
    "heading": [{ "type": "heading3", "content": { "text": "About Reservations", "spans": [] } }],
    "current": true
  },
  "items": [
    { "question": "Network and Timetable", "href": "/network-and-timetable" },
    { "question": "Payment", "href": "/payment" }
  ]
}
```

### Rendering

- Built on shadcn's `Accordion` (`type="single" collapsible`) — **one `Accordion` root per slice instance**, each wrapping exactly one `AccordionItem`. This is deliberate: keeping each category's open/closed state in its own Radix root means expanding one category never affects the others' state (they're independent components, not siblings inside one shared root).
- `defaultValue` is `"category"` when `current` is `true`, `undefined` otherwise.

---

## Variation: `footer_grid`

One always-visible category tile for the level-2/3 pages' Footer zone, laid out as a 4-column grid on `sm:`+ screens. On mobile, it becomes a real collapsible accordion instead — see [Responsive behavior](#responsive-behavior-footer_grid-only) below.

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `heading` | Rich Text (single: `heading2,heading3,strong,em`) | Yes | Category name. |
| `mobile_section_heading` | Text | No | **Set on the first tile only** (e.g. "About Reservations" if it's category #1). Renders as a heading above the whole grid, mobile-only. Leave blank on every other tile in the group. |

### Item fields

Same as `default`.

### Example content

```json
{
  "primary": {
    "heading": [{ "type": "heading3", "content": { "text": "About Reservations", "spans": [] } }],
    "mobile_section_heading": "User Guide"
  },
  "items": [
    { "question": "Network and Timetable", "href": "/network-and-timetable" }
  ]
}
```

### Responsive behavior (`footer_grid` only)

This variation renders **two markup trees simultaneously**, toggled by Tailwind responsive `display` utilities rather than JS — both are always in the DOM, only one is visible at a time:

- `sm:` and up: `hidden sm:block` — the always-visible title + vertical link list (no collapse).
- Below `sm:`: `sm:hidden` — a shadcn `Accordion` (`type="single" collapsible`), with `mobile_section_heading` (if set) rendered above it.

Why two trees instead of one that reflows: keeping desktop's "always expanded, no accordion" behavior pixel-identical to how it looked before mobile support was added, while adding real collapse/expand interactivity only where the design calls for it (mobile). A single shared tree styled purely with CSS couldn't give desktop "no accordion" and mobile "real accordion" behavior at the same time, since Radix's `AccordionContent` unmounts when closed regardless of viewport.

**Because `mobile_section_heading` is per-tile, remember to set it only once per category group** (the first tile) — setting it on every tile would repeat "User Guide" six times on mobile.

---

### Navigation note (all `href` links in this slice)

Every variation's `question`/`href` rows render via `next/link`'s `Link` component, not a plain `<a href>`. A raw anchor forces a full browser page reload on every click (visible white-flash, all React state/layout re-mounted); `Link` does a client-side transition instead — it fetches only the target route's payload and keeps shared layout (header/footer chrome, if any) mounted, so navigating between FAQ question pages feels instant rather than a hard refresh. This matters here specifically because these `href` values are plain Text-field strings (not a Prismic `Link` field), so `PrismicNextLink` doesn't apply — `next/link`'s `Link` is the equivalent for a plain string URL.

## Variation: `withicon`

## Known limitations

- **`withicon` is not implemented.** Its `model.json` entry exists (identical field shape to `grid`: `heading` + `description` primary, `question`/`href` items) but `index.tsx`'s `if` chain only special-cases `"accordion"`, `"footer_grid"`, and `"grid"` — anything else, including `"withicon"`, falls through to the `default` branch's rendering. If you pick this variation in the Prismic dashboard, you'll get the plain chevron-nav-row list, not whatever "with icon" was originally meant to look like. Either implement a real render branch for it or remove the variation from `model.json` to stop it from being offered as a choice.
- `default` variation's `number`/`text` primary fields are unused legacy cruft (pre-dating this doc) — safe to ignore when authoring content, worth removing from the schema in a future cleanup.
- `grid` variation's `description` primary field is defined but never rendered.

## Related slices

- [`Accordion`](../Accordion/README.md) / [`DisclosureList`](../DisclosureList/README.md) — the general-purpose (non-FAQ-specific) collapsible-section slices, for comparison.
- [`LinkList`](../LinkList/README.md) — simpler stacked-chevron-links slice, unrelated to the category/question data model here but visually similar to `default`'s rows in spirit.
