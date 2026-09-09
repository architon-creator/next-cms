# FaqAnswerSwap

A client-side Q&A card: one "active" question + its rich-text answer, plus a "Related question" card listing the other questions in the group. Clicking a related question swaps the active card's content in place — no page navigation, no URL change.

**Live examples**: none authored yet — built for the "Network and Timetable" category page's question list, to replace navigating to a separate page per question.

## When to use

- A small group of related questions (all belonging to one category/topic) where you want the reader to compare answers without losing their place, and where the questions don't need their own individually-indexable URLs.
- **Not** a drop-in replacement for `FaqQuestionList`'s `default` variation when each question genuinely needs its own page (own URL, own SEO metadata, own breadcrumb) — that's still the right model when questions are deep-linked from elsewhere (level-1 hub, aside accordion, footer grid all link by URL). This slice's items are **not separately routable**; only the page it's on has a URL.

## Variation: `default`

### Primary fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `related_heading` | Text (default `Related question`) | No | Heading on Card 2. Falls back to `"Related question"` at render time if left blank. |

### Item fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `question` | Text | Yes | Shown as the active card's title (Card 1) when selected, and as a clickable row in the related list (Card 2) otherwise. |
| `answer` | Rich Text (multi: `paragraph,strong,em,hyperlink,list-item,o-list-item`) | Yes (in practice) | The active card's body when this item is selected. |

### Example content

```json
{
  "primary": { "related_heading": "Related question" },
  "items": [
    {
      "question": "Where does ZIPAIR fly to?",
      "answer": [{ "type": "paragraph", "content": { "text": "ZIPAIR currently flies to...", "spans": [] } }]
    },
    {
      "question": "Where can I check the flight status?",
      "answer": [{ "type": "paragraph", "content": { "text": "You can check flight status on...", "spans": [] } }]
    },
    {
      "question": "How many days in advance can I book a flight?",
      "answer": [{ "type": "paragraph", "content": { "text": "Bookings open...", "spans": [] } }]
    }
  ]
}
```

## Rendering & behavior

- `"use client"` component — the only client component in the slice library. Holds `activeIndex` in local `useState`, defaulting to `0` (the first item).
- Card 1 (`Card`/`CardHeader`/`CardTitle`/`CardContent` from `@/components/ui/card`): `items[activeIndex]`'s `question` as the title, `answer` rendered via `PrismicRichText`.
- Card 2: rendered only when there's more than one item (`items.length > 1`). Lists every item **except** the active one as a `<button type="button">` (not a link — clicking never navigates or changes the URL), each calling `setActiveIndex(index)`.
- Because all answers ship in the initial page payload (there's no per-question fetch), keep the number of items and answer length reasonable for one page load — this isn't built for dozens of long-form answers in one group.

## Styling conventions

- Card 2 uses `bg-muted` (same "secondary card" treatment as `InfoCardList`) to visually recede behind the active Card 1.
- Related-question buttons: `font-semibold text-primary hover:bg-accent hover:underline`, matching the chevron-link color used elsewhere, but as a `<button>` since there's no navigation.

## Known limitations

- **No deep-linking**: reloading the page, sharing the URL, or using browser back/forward always lands on item `0` — the selected question isn't reflected in the URL (e.g. no `?q=` or hash). Add one if deep-linking a specific answer becomes a requirement.
- **No keyboard/URL-driven initial selection** — there's no field to pick which item starts active; it's always the first item in the list.
- All answers are always in the DOM/payload (not fetched on demand) — fine for a handful of short answers, not designed for large content sets.

## Related slices

- [`FaqQuestionList`](../FaqQuestionList/README.md) — the navigation-based alternative (`default` variation): each question is a link to its own page, no client state involved. Use that instead when questions need their own URLs.
- [`Accordion`](../Accordion/README.md) — a different way to show multiple Q&A-shaped items at once (all expanded/collapsible independently, not a single active-item swap).
