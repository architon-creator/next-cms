# QuestionAnswer

> Ported from the real production project's FAQ system, as a reference/practice copy — not used on any live page in this repo yet. See [`docs/FAQ/faq-system.md`](../../../../../docs/FAQ/faq-system.md).

The active answer card for whichever topic is currently selected, plus a "Related Questions" list — a pure reader of shared FAQ topic state.

**Live examples**: none in this repo.

## Variation: `default`

- `default_topic` (Select, 11-key vocabulary): same role as `QuestionList`'s field — seeds the page's `FaqTopicProvider`.
- `items` (repeatable): `topic` (Select, same vocabulary), `question` (Text), `answer` (StructuredText — full multi-block support: headings 1–6, images, embeds, preformatted, RTL), `related_question_label` (Text), `related_question_link` (Link).

## Rendering & behavior

- Filters `items` to `item.topic === activeTopic`, then destructures `[main, ...related] = visible`.
- **Only `main` (the first matching item) displays its `question`/`answer`.** The `related` items' own `question`/`answer` are never shown — only their `related_question_label`/`related_question_link` render, as the "Related Questions" list below the answer. In other words: to add a related-question link under a topic's answer, author an _additional_ `items` entry with the same `topic`, leave `question`/`answer` blank (or ignore them), and fill only `related_question_label`/`related_question_link`.
- Renders nothing (`null`) if no items match `activeTopic`.
- `aria-live="polite"` for the same reason as `QuestionList`.

## Known limitations

- Extra same-topic items exist solely to carry a related-link record — their `question`/`answer` fields are dead weight if filled in, which could confuse a content editor unfamiliar with this convention. Worth a content-authoring note/tooltip in Prismic if this pattern gets used for real.

## Related slices

- [`FaqAccordion`](../FaqAccordion/README.md) (`sidebar_nav`) — writes `activeTopic`.
- [`QuestionList`](../QuestionList/README.md) — the other topic-keyed reader.
