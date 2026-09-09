# FileDownloadList

A standalone stack of outline download buttons, each with a label and a "File Size: ..." caption underneath.

**Live examples**: none currently — `special-assistance`'s three download groups (previously this slice) were migrated into [`DisclosureList`](../DisclosureList/README.md)'s `files` field, so they render inside the relevant topic's collapsible panel instead of as a separate, always-visible block below it. See [When NOT to use](#when-not-to-use).

## When to use

- A prominent group of downloadable files (forms, PDFs) that stands on its own — **not** tied to a specific `DisclosureList` topic's collapsible content.

## When NOT to use

- **Download buttons belong inside a `DisclosureList` topic's box** (the common case — e.g. "submit this form for X topic") → use `DisclosureList`'s own `files` field instead of this slice. A separate `FileDownloadList` instance placed after a `DisclosureList` item is a **different slice, not inside the accordion** — collapsing that topic won't hide the buttons, and no CSS trick changes that (this was tried: matching backgrounds/rounded corners can make two adjacent slices _look_ like one box, but they still don't collapse together). This is exactly the mistake that was corrected on `special-assistance`.

## Variation: `default`

No primary fields.

### Item fields

| Field       | Type                                                | Required | Notes                                                                   |
| ----------- | --------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `label`     | Text                                                | Yes      | Button text.                                                            |
| `file`      | Link (target-blank allowed; typically a Media link) | No       | If empty, the button renders `disabled` instead of as a link.           |
| `file_size` | Text                                                | No       | Freeform, e.g. `504KB`. Caption below the button, only rendered if set. |

### Example content

```json
{
  "items": [
    {
      "label": "MEDICAL INFORMATION FORM (Questionnaire)",
      "file": { "url": "#" },
      "file_size": "504KB"
    },
    { "label": "US DOT Form", "file": { "url": "#" }, "file_size": "369KB" }
  ]
}
```

## Rendering & behavior

- Built on shadcn's `Button` (`ui`), `variant="outline"`.
- `isFilled.link(item.file)` decides link-vs-disabled: filled → `Button asChild` wrapping `PrismicNextLink`; empty → plain `Button disabled`.
- Items stack vertically, `max-w-80` container — intentionally narrow, matching the reference design's compact button column (not full-width buttons).
- No background/box styling of its own — a plain block on the page background. (An earlier version of this slice tried giving it a `bg-muted` box to visually merge with an adjacent `DisclosureList` box; that approach is deprecated — see [When NOT to use](#when-not-to-use).)

## Styling conventions

- Same `border-primary! text-primary! hover:bg-accent!` treatment as `ButtonLink`.
- Disabled state: `border-border! text-muted-foreground! opacity-100!` (overriding shadcn's default dimmed-opacity disabled look, since this button is disabled because "no file uploaded yet," not because an action is unavailable — a full-opacity muted look reads better here).

## Known limitations

- No progress/loading state — purely a static link/button (file downloads are native browser behavior, not client-side JS).
- All files in one instance render as a single flat list — if a design needs, say, a 2-column grid of download buttons, this slice would need a new variation.
- No grouping/sub-heading support for stacking several buttons under one label within a single instance. `DisclosureList`'s `files` field has the same limitation.

## Related slices

- [`ButtonLink`](../ButtonLink/README.md) — single centered button, for a non-file CTA.
- [`DisclosureList`](../DisclosureList/README.md) — has its own `files` field for the "downloads tied to one collapsible topic" case; prefer that over this slice whenever that's the situation.
