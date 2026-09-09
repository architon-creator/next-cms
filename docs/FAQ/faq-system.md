# FAQ System

The FAQ area is not a single page — it's three levels of `content_page` documents, all built from the same slice library, that link into each other. This doc maps **which component (slice + variation) is used in which zone, at each level**, based on the live content in `next-js-ssr`.

See also: [`slices/README.md`](../../slices/README.md) for how zones/pages are assembled in general, and [`slices/FaqQuestionList/README.md`](../../slices/FaqQuestionList/README.md) / [`slices/FaqAnswerSwap/README.md`](../../slices/FaqAnswerSwap/README.md) for full field references. Reference screenshots for the three levels: `level-1.png`, `level-2.png`, `level-3.png` in this folder.

## The three levels

| Level | Purpose | Example document(s) |
|---|---|---|
| **1 — Hub** | One page listing every category, each with all its questions inline. The entry point (`/faq`). | `faq` |
| **2 — Category** | One page per category/topic, listing that category's questions as a nav list. | `network-and-timetable`, `payment` |
| **3 — Question** | One page showing a question's answer, with a switcher to related questions in the same category — no page reload when switching. | `where-does-zipair-fly-to` |

All three levels share the same **Aside** (category accordion) and **Footer** (category grid) — that's what makes every FAQ page feel like part of one system rather than three different page types. Only **Main** differs per level.

## Component matrix

| Zone | Level 1 (`faq`) | Level 2 (`network-and-timetable`, `payment`) | Level 3 (`where-does-zipair-fly-to`) |
|---|---|---|---|
| **Heading** | — (no `PageTitle`/`Breadcrumbs` on this doc; see [Known gaps](#known-gaps)) | [`PageTitle`](../../slices/PageTitle/README.md) + [`Breadcrumbs`](../../slices/Breadcrumbs/README.md) | [`PageTitle`](../../slices/PageTitle/README.md) + [`Breadcrumbs`](../../slices/Breadcrumbs/README.md) |
| **Main** | [`RichTextSection`](../../slices/RichTextSection/README.md) ("FAQ" heading) → 6× [`FaqQuestionList`](../../slices/FaqQuestionList/README.md) (`grid` variation, one per category) → `RichTextSection`/[`Callout`](../../slices/Callout/README.md) (Inquiries block) → [`ButtonLink`](../../slices/ButtonLink/README.md) (Contact Form) | 1× `FaqQuestionList` (`default` variation) — plain question list for this one category | 1× [`FaqAnswerSwap`](../../slices/FaqAnswerSwap/README.md) (`default` variation) — active Q&A card + related-question switcher, **client-side, no navigation between the group's questions** |
| **Aside** | *(not present on this document)* | 6× `FaqQuestionList` (`accordion` variation) — one per category, the current page's category has `current: true` so it starts expanded | Same as level 2 — 6× `accordion`, current category expanded |
| **Footer** | *(not present on this document)* | 6× `FaqQuestionList` (`footer_grid` variation) — one per category, 4-column grid on `sm:`+, collapsible accordion on mobile | Same as level 2 — 6× `footer_grid` |

The 6 categories (same order everywhere): *About Reservations, Reservation confirmation and changes, About optional services, About Support, Regarding Flight Status and Handling of Cancellations/Delays, On the Day of Boarding.*

## How the levels connect

- Level 1's `grid` blocks and level 2/3's `accordion`/`footer_grid` blocks all point at the **same set of URLs** (e.g. `/network-and-timetable`, `/payment`, `/special-assistance`) — they're independent slice instances with duplicated link data, not a shared data source. Adding a new category page means updating all three places (level-1 `grid` block, and every level-2/3 page's `accordion` + `footer_grid` instances) — see the [flat-slice limitation](../../slices/README.md#conventions-used-across-every-slice) for why this can't be a single nested structure.
- Every `href` in `FaqQuestionList` is a **plain Text field**, not a Prismic Link field — so these are always full string URLs (`/network-and-timetable`, `#` for not-yet-built targets), rendered via `next/link`'s `Link` for client-side transitions (see [Navigation note](../../slices/FaqQuestionList/README.md#navigation-note-all-href-links-in-this-slice)) rather than a hard page reload.
- Level 2 → Level 3 is still a real page navigation (different URL, e.g. `/network-and-timetable` → `/where-does-zipair-fly-to`) — client-side via `Link`, but still a route change. **Within** a level-3 page, switching between that category's questions (via `FaqAnswerSwap`'s Card 2) does **not** navigate at all — it's local React state, so the URL and the rest of the page stay put.

## Level 3 in detail: why `FaqAnswerSwap` instead of `RichTextSection` + `ButtonLink`

`where-does-zipair-fly-to` originally used `RichTextSection` (the answer) + `ButtonLink` ("See Related Questions List" → back to the level-2 page) in Main. That meant answering a *different* question in the same category required leaving the page entirely. `FaqAnswerSwap` replaces both: Card 1 shows the active question's answer, Card 2 lists the category's other questions as buttons that swap Card 1 in place. See [`slices/FaqAnswerSwap/README.md`](../../slices/FaqAnswerSwap/README.md#known-limitations) for what this trades away (no deep-linking to a specific question within the group, no server-rendered initial selection).

## Known gaps

- **Level 1 (`faq`) has no `Heading` zone content** (no `PageTitle`/`Breadcrumbs`), and no `Aside`/`Footer` — it's a flat Main-only page. This is consistent with it being the top of the hierarchy (no "current category" to highlight, nothing to link back to), but means the site header/breadcrumb trail may look inconsistent between the hub and the level-2/3 pages. Worth revisiting if that inconsistency turns out to matter.
- **Only one level-3 page exists** (`where-does-zipair-fly-to`) with the new `FaqAnswerSwap` treatment — its sibling questions in the "Network and Timetable" category ("Where can I check the flight status?", "How many days in advance can I book a flight?") only exist as dummy placeholder answers inside that one `FaqAnswerSwap` instance, not as their own level-3 pages. `payment`'s Main zone is still the old level-2-style plain list (`default` variation) with dummy `#` links — it hasn't been converted to a level-3/`FaqAnswerSwap` page yet.
- The `where-does-zipair-fly-to` change (removing `RichTextSection`/`ButtonLink`, adding `FaqAnswerSwap`) is staged in a Prismic release, **not yet published** — the live site may still show the old layout until that's published from the dashboard.
