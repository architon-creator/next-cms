# QuestionList

> Ported from the real production project's FAQ system, as a reference/practice copy — not used on any live page in this repo yet. See [`docs/FAQ/faq-system.md`](../../../../../docs/FAQ/faq-system.md).

The list of individual questions belonging to whichever topic is currently active — a pure reader of shared FAQ topic state, never a writer.

**Live examples**: none in this repo.

## Variation: `default`

- `default_topic` (Select, 11-key vocabulary): seeds the page's `FaqTopicProvider` on initial load (read by the page, not by this component directly).
- `questions` (repeatable): `topic` (Select, same vocabulary — must match `FaqAccordion`'s `topic` field), `heading` (Text), `question` (Text), `question_link` (Link — a **real navigational link**, not a topic-switcher).

## Rendering & behavior

- Reads `activeTopic` via `useFaqTopic()` and filters `questions` down to `item.topic === activeTopic` — renders nothing (`null`) if none match.
- `heading` is taken from `visible[0]?.heading` — so, like `FaqAccordion`'s `category_title`, it doesn't matter whether every item in a topic group repeats the same heading or only one does; the result is identical either way.
- Each visible question renders as a `PrismicLink` using `question_link` — this is a plain link (e.g. to a specific sub-question/anchor), **not** a call to `setActiveTopic()`. Topic switching only ever happens in `FaqAccordion`'s `sidebar_nav` variation.
- `aria-live="polite"` on the section — announces the content change to screen readers when the topic swaps without a page reload.

## Related slices

- [`FaqAccordion`](../FaqAccordion/README.md) (`sidebar_nav`) — the only component that writes `activeTopic`.
- [`QuestionAnswer`](../QuestionAnswer/README.md) — the other topic-keyed reader, showing the actual answer content.
