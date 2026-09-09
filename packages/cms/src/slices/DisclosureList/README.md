# DisclosureList

One collapsible, unnumbered topic — intro text, an optional highlighted sub-box, an optional list of download buttons _inside_ that box, and an optional trailing link. `Accordion`'s unnumbered sibling. Every page uses one slice instance per topic (see [Rendering & behavior](#rendering--behavior)).

**Live examples**: `special-assistance` — 8 instances (Passengers who require a wheelchair, Hearing-impaired customers, Visually impaired customers, Customers with intellectual and developmental disabilities, Special Assistance for Medical Needs, Pregnant Customers, Customers with Assistance Dogs, Those who require two seats).

## When to use

- A list of independent policy/eligibility topics that don't form a numbered sequence, each as its own collapsible section.
- A topic needs: intro body text, optionally a highlighted sub-box (e.g. "Accompanied by a Hearing Dog"), optionally a list of download buttons inside that box, optionally one trailing link.

## When NOT to use

- Content is a numbered step-by-step sequence → use [`Accordion`](../Accordion/README.md).
- You need two trailing links → use `Accordion` (which supports `link`/`link2`), or follow this slice with a [`LinkList`](../LinkList/README.md).
- Downloads that aren't tied to a specific topic's collapsible content → use a standalone [`FileDownloadList`](../FileDownloadList/README.md) instance instead.

## Variation: `default`

Everything lives on primary fields — **one instance holds exactly one topic** (this slice has no repeatable `items`; for multiple topics, add multiple slice instances stacked in the same zone).

### Primary fields

| Field         | Type                                                                     | Required | Notes                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Text                                                                     | Yes      | Section heading.                                                                                                                                                                                                                                                                                                                                                                   |
| `body`        | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`) | No       | Main content, shown above the box (if any).                                                                                                                                                                                                                                                                                                                                        |
| `box_heading` | Text                                                                     | No       | Heading for the highlighted sub-box. Only rendered if `box_body` has content.                                                                                                                                                                                                                                                                                                      |
| `box_body`    | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`) | No       | The `bg-muted` box's content — put here anything that should render _inside_ the shaded box, including text introducing the downloads below.                                                                                                                                                                                                                                       |
| `files`       | Group: `label` (Text), `file` (Link), `file_size` (Text)                 | No       | Repeatable download buttons, rendered inside the same shaded box as `box_body` (or in their own box if `box_body` is empty). This is a Group directly on `primary` — legal in Prismic, unlike nesting a Group inside a repeatable `items` zone (see the [flat-slice limitation](../README.md#conventions-used-across-every-slice)), which is why this slice has no `items` at all. |
| `link_label`  | Text                                                                     | No       | Trailing link text.                                                                                                                                                                                                                                                                                                                                                                |
| `link`        | Link (target-blank allowed)                                              | No       | Trailing link — only one, unlike `Accordion`.                                                                                                                                                                                                                                                                                                                                      |

### Example content

```json
{
  "primary": {
    "title": "Customers with Assistance Dogs for Persons with Disabilities",
    "body": [
      {
        "type": "paragraph",
        "content": {
          "text": "Assistance dogs for persons with physical disabilities...",
          "spans": []
        }
      }
    ],
    "box_body": [
      {
        "type": "paragraph",
        "content": { "text": "On U.S. and Canada-bound flights...", "spans": [] }
      }
    ],
    "files": [
      { "label": "US DOT Form", "file": { "url": "#" }, "file_size": "369KB" },
      {
        "label": "SERVICE DOG CONSENT FORM",
        "file": { "url": "#" },
        "file_size": "1125KB"
      }
    ]
  }
}
```

## Rendering & behavior

- Built on shadcn's `Accordion` (`@/components/ui/accordion`) — one `Accordion` root per instance, `type="multiple"`, `defaultValue={["item"]}` so it starts open, same "all open by default, individually collapsible" convention as `Accordion`.
- An item with an entirely empty `body` (e.g. "Passengers who require a wheelchair" on `special-assistance`) is valid — the panel just renders whatever other fields are filled.
- **`box_body` + `files`**: both render inside the same `AccordionContent`, so collapsing the topic hides everything — box text and download buttons together. This replaced an earlier approach that used a separate `FileDownloadList` slice instance placed after this one: that only ever _looked_ attached (via matching background/rounded-corner CSS tricks) but was a different slice that stayed visible even when this topic was collapsed. Keeping downloads as a `files` group on this slice avoids that gap entirely.
- Box/files box corner rounding: when both `box_body` and `files` are filled, the box renders `rounded-t-md` and the files block `rounded-b-md` directly below with no gap, so they read as one continuous card. When only one of the two is filled, that one gets full `rounded-md` corners on its own.
- Both the `box_body` box and the `files` block share `max-w-xl` so the shaded card doesn't stretch to the full Main-column width on wide screens (which left a large dead gray gap next to the narrower `max-w-80` buttons) — the card now stays a consistent, moderate width regardless of viewport, with individual file buttons narrower still (`max-w-80`) inside it.

## Styling conventions

- Trailing link uses the shared [`ChevronLink`](../../components/ui/chevron-link.tsx) component with `chevron={false}` — same `font-semibold text-primary` color/weight as `Accordion`'s links, but _without_ the trailing `›` or row spacing (a plain inline link, not a stacked row).
- `box_body` paragraphs render at `text-[0.9rem]` — visibly smaller than the main `body` text above it (matches the reference design's two font sizes).
- `files` buttons reuse `FileDownloadList`'s exact button treatment (`border-primary! text-primary! hover:bg-accent!` outline `Button`, disabled state for an empty `file` link) — see [`FileDownloadList`'s styling conventions](../FileDownloadList/README.md#styling-conventions) for the shared look, even though the markup isn't literally shared code between the two slices.
- Same `AccordionItem` border override pattern (`border-t! border-b-0! last:border-b!`) as `Accordion` for a single divider between items.

## Known limitations

- One trailing link only (vs. `Accordion`'s two) — by design, since this slice's original driving use case never needed a second link.
- No grouping/sub-heading support within `files` (e.g. "U.S. Origin-Destination Service" / "Canada-bound Service" as sub-groups above different buttons) — every file in one instance renders as one flat stack, in field order.
- Since there's no `items` any more, "one instance = one topic" is now enforced by the schema itself, not just a convention — there's no way to accidentally put two topics in one instance.

## Related slices

- [`Accordion`](../Accordion/README.md) — numbered sibling, supports two trailing links and a "necessities" checklist box.
- [`FileDownloadList`](../FileDownloadList/README.md) — standalone download-button stack for downloads _not_ tied to one collapsible topic's content.
