# BoardingProcessStep

One numbered boarding-process step, with a free-form, drag-ordered content stream (`content_blocks`, discriminated by `block_type`) instead of Accordion's fixed `body`/`blocks` fields. Built to replace `Accordion`'s `default` variation on the `boarding-process` page once a step needs more than `title`/`body`/`necessities` can express — see [Accordion/README.md](../Accordion/README.md) for the slice this supersedes on that page.

## Why this exists

`Accordion`'s `default` variation (still live on `boarding-process` today) gives every step the same fixed shape: one `body` rich text, one `necessities` box. That's enough for six of the current steps, but a step needing several sub-headings each with their own mix of paragraphs, callouts or cards can't be expressed there — and `with_cards`'s `blocks` Group loses the shared step numbering, since it's one slice instance per topic with no numbering field at all.

`BoardingProcessStep` keeps per-step numbering (`step_number`, a `primary` field, not derived from array position, since each step is its own slice instance) while giving the unpredictable part of a step — the content itself — the same free ordering `Accordion`'s `blocks` Group already has: **one repeatable Group, each row tagged by `block_type`, array position is the render order.** See [the flat-slice limitation](../README.md#conventions-used-across-every-slice) for why this can't be a nested Group inside `Accordion`'s own `items` instead.

## When to use

- A boarding-process (or similarly step-numbered) page where a step needs more than a single body + necessities box — headings, callouts, cards and buttons in whatever order the content calls for.
- `display_mode` lets the same slice cover both a collapsible step (`accordion`) and an always-visible one (`static`), so you don't need a second variation the way `Accordion` needs `with_cards`.

## When NOT to use

- A step that only needs `title`/`body`/`necessities`/two trailing links → keep using `Accordion`'s `default` variation; no need to migrate steps that already fit.
- Content that isn't numbered steps at all → [`FlexibleContent`](../FlexibleContent/README.md) or `Accordion`'s `with_cards`.

## Variation: `default`

### Primary fields

| Field                                          | Type                                                                                               | Notes                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `step_number`                                  | Number                                                                                              | Rendered as `"N. Title"`. Not auto-derived — each step is its own instance.    |
| `step_title`                                   | Text                                                                                                | |
| `display_mode`                                 | Select (`accordion` default, `static`)                                                              | `static` renders always-open, no trigger.                                      |
| `start_expanded`                               | Boolean                                                                                             | Only relevant when `display_mode` is `accordion`.                              |
| `note`                                         | Text                                                                                                | Same grey bold-note box as `Accordion`.                                        |
| `necessities_heading` / `necessities`          | Text / Rich Text (`heading4,paragraph,strong,em,hyperlink`)                                         | Same definition-list box as `Accordion`, rendered after `content_blocks`.      |
| `footnote`                                     | Rich Text (`paragraph,strong,em,hyperlink`, labels `muted`/`small`)                                 | |
| `link_label`/`link`, `link2_label`/`link2`     | Text, Link                                                                                          | Trailing chevron links, same as `Accordion`.                                   |
| `content_blocks`                               | Group — see below                                                                                   | The flexible content stream.                                                   |

**Render order:** `note` → `content_blocks` → `necessities_heading` + `necessities` → `footnote` → `link` → `link2` — identical order to `Accordion`'s `with_cards` variation, with `content_blocks` in place of `blocks`.

### `content_blocks` — the flexible content stream

One repeatable Group on `primary` (the slice's native `items` zone is unused). **Every row is a block; `block_type` says which kind.** Order and count are the Group's own order — drag to reorder in Prismic, no manual sequence field.

| Field         | Type                                                                                                      | Notes                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `block_type`  | Select: `subheading, section_heading, paragraph, callout, note, info_card, link_note, button`               | Discriminates the row — explicit, not inferred from which fields are filled (unlike `Accordion`'s `blocks`). |
| `content`     | Rich Text (`heading3,heading4,paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted,small,roman`) | Used by every `block_type` except `button`.                                             |
| `button_label`, `button_link` | Text, Link                                                                                    | Used only when `block_type` is `button`.                                                |

`info_card` splits its `content` on every `heading4` into a card title + body, via [`lib/content-blocks/rows.ts`](../../lib/content-blocks/rows.ts)'s `splitRows` — the same split logic `SpecBoxList`'s `rows` field uses, unit-tested in `rows.test.ts`. Content before the first `heading4`, if any, renders under an untitled card rather than being dropped.

## Rendering & behavior

- Text always renders through `PrismicRichText` (`listRichTextComponents` for most blocks, `richTextLabelComponents` inside `info_card`'s split cards) — never hand-parsed — so `strong`/`em`/`hyperlink`/label marks all render correctly with no bespoke span-walking code to maintain.
- Layout per `block_type` (heading size, callout box, etc.) is a thin wrapper around the rich text output — see `layoutByBlockType` in `index.tsx`.
- Keys for `content_blocks` and `info_card`'s split cards are the array `index`, matching `Blocks.tsx`'s convention — correct here specifically because array position is the authoritative order, so two blocks with identical content can't collide on key.
- Shares `Accordion`'s trigger/panel styling (`../Accordion/styles.ts`) so a stack of `BoardingProcessStep` instances looks identical to `Accordion`'s `default` steps.

## Known limitations

- `step_number` is a manual field, not derived — if steps are reordered in the slice zone, the numbers don't renumber themselves (same tradeoff `Accordion`'s `with_cards` topics already accept by having no number at all).
- No Roman-numeral support signal beyond the `roman` label convention already documented on `Accordion`.

## Related slices

- [`Accordion`](../Accordion/README.md) — `default` variation is this slice's predecessor on `boarding-process`; `with_cards` is the un-numbered flexible-topic sibling.
- [`FlexibleContent`](../FlexibleContent/README.md) — the non-collapsible, non-numbered version of a blocks-style stream.
