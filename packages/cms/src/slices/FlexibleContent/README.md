# FlexibleContent

An always-visible, non-collapsible free-form stream of blocks: text, images, cards, links and buttons, in any order, any count. It's the same **`blocks`** model and renderer used by [`Accordion`](../Accordion/README.md)'s `with_cards` variation — this slice exists for content that shouldn't collapse at all.

**Live examples**: none yet — created alongside `Accordion`'s `with_cards` variation as its non-collapsible sibling.

## When to use

- A section needs a mix of text, images, cards, links and buttons **in whatever order the design calls for**, and it should just be shown — no trigger, no toggle.
- You'd otherwise be tempted to use `Accordion`'s `with_cards` variation just to get the `blocks` field, on content that was never meant to collapse.

## When NOT to use

- The content should collapse/expand → [`Accordion`](../Accordion/README.md)'s `with_cards` variation (identical `blocks` field, wrapped in a trigger).
- A numbered step-by-step sequence → `Accordion`'s `default` variation.
- A plain heading + body with no blocks → [`RichTextSection`](../RichTextSection/README.md).

## Variation: `default`

| Field   | Type                                                                                                  | Required | Notes                                                    |
| ------- | -------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| `title` | Text                                                                                                  | No       | Optional bold heading above the body/blocks.               |
| `body`  | Rich Text (`paragraph,strong,em,hyperlink,list-item,o-list-item`; labels `muted`, `small`, `roman`)   | No       | Optional intro text, before the `blocks` stream.            |
| `blocks`| Group — see [Blocks](#blocks)                                                                        | No       | Any number of blocks, any order.                             |

**Render order:** `title` → `body` → `blocks`.

## Blocks

Same field set, same rules, same renderer as [`Accordion`'s `with_cards` variation](../Accordion/README.md#blocks-the-flexible-content-stream) — see that section for the full field table and the Case 1 / Case 2 examples. Both slices share [`packages/cms/src/lib/content-blocks/`](../../lib/content-blocks/), so a block renders identically whichever slice it's in.

## Rendering & behavior

- Plain `<section>`, `mt-6` top margin — no `Accordion`/trigger/collapse involved.
- Title styled `text-lg font-bold text-ink` (bold, no box, no icon) — this is not a collapsible header.
- Everything else (block rendering, Roman-numeral lists, the grey card box) is identical to `with_cards` because it's the same shared code.

## Known limitations

- No `note`, `necessities`, `footnote` or trailing-link fields — those are `Accordion`-specific concepts (tied to a "topic"). If a non-collapsible section needs one of those, ask whether it should actually be a `with_cards` instance instead (with `start_expanded` on, so it renders open and is never meant to be collapsed by an editor) before adding fields here.
- Shares [Accordion's known limitations](../Accordion/README.md#known-limitations) around `blocks` (fixed field order per block, no dynamic/conditional fields — see that README's note on why Prismic can't do that).

## Related slices

- [`Accordion`](../Accordion/README.md) `with_cards` variation — the collapsible version of this exact content model.
- [`InfoCardList`](../InfoCardList/README.md) — a simpler stack of cards only (no text/image/link/button blocks, no collapsing).
- [`RichTextSection`](../RichTextSection/README.md) — a plain heading + body, no blocks.
