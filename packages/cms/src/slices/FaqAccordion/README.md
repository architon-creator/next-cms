# FaqAccordion

> Ported from the real production project's FAQ system, as a reference/practice copy — not used on any live page in this repo yet. See [`docs/FAQ/faq-system.md`](../../../../../docs/FAQ/faq-system.md) for why this exists alongside `FaqQuestionList`.

Two unrelated variations sharing one slice id: a generic Q&A accordion, and the FAQ sidebar category navigator that drives the whole topic-switching system.

**Live examples**: none in this repo.

## Variation: `default`

A plain, topic-unrelated FAQ block — `title` + repeatable `qa` (question/answer) pairs, rendered as a single-select accordion. Comparable to a simpler `DisclosureList`/`Accordion`.

## Variation: `sidebar_nav`

The FAQ topic switcher. `links` (repeatable): `category_title` (Text, repeated on every item in a group — grouped client-side via `.reduce`, so order doesn't matter), `link_label` (Text), `topic` (Select, fixed 11-key vocabulary shared with `QuestionList`/`QuestionAnswer`).

### Rendering & behavior

- Reads/writes `activeTopic` via `useFaqTopic()` (`../../lib/faq-topic-context`). Clicking a link calls **both** `setActiveTopic(topic)` (instant client re-render) **and** `router.replace(`${pathname}?topic=${topic}`, { scroll: false })` — so every topic switch stays reflected in the URL (shareable/bookmarkable), unlike this repo's own `FaqAnswerSwap`, which has no URL sync at all.
- "Current" highlighting (`aria-current`, styling) is fully derived from `activeTopic === item.topic` — no boolean flag field anywhere, unlike `FaqQuestionList`'s `current` field or `footer_grid`'s `mobile_section_heading`-on-first-item convention.
- `defaultValue={categories[0]?.[0]}` always expands the _first_ category group by default, regardless of which category the active topic actually belongs to — a known, unfixed UX gap in the source implementation, carried over as-is here.

## Known limitations

- Same as the source: first-category-always-expanded default doesn't track `activeTopic`.

## Related slices

- [`QuestionList`](../QuestionList/README.md), [`QuestionAnswer`](../QuestionAnswer/README.md) — the two topic-keyed readers this slice's clicks drive.
- [`FaqQuestionList`](../FaqQuestionList/README.md), [`FaqAnswerSwap`](../FaqAnswerSwap/README.md) — this repo's own, simpler prototype covering similar ground.
