# Creating a new slice

How to add a new Prismic shared slice to this project: model it, build the React component, register it, and get content into it. For a full worked example (a collapsible-sections slice built on shadcn/ui) see [accordion-slice-guide.md](accordion-slice-guide.md).

There are two ways models are managed, and it changes step 1:

- **Local models (this repo):** each slice has a `model.json` file, pushed to Prismic with the `prismic` CLI.
- **Type Builder (some real projects):** the model is created directly in the Prismic dashboard; there is no local model file.

Everything else is the same either way.

## Before you start

Answer these first — they decide the model:

1. **What varies between uses of this slice?** Only what varies becomes a field. Anything that never changes is just markup in the component.
2. **Primary vs items.** One instance's worth of fields → `primary`. A repeatable list (steps, cards, links) → `items`.
3. **One slice or a variation?** Same fields, different look → a second **variation** of one slice. Different fields → a **new slice**.
4. **Which page zones** will use it (`heading`, `main`, `aside`, `footer`, or your project's equivalents)?
5. **What should existing pages do** once the field exists? A new field is empty/`false`/`null` on every page that doesn't set it — design the field so that default is the wanted behaviour (see [Field defaults](#field-defaults-matter)).

## 1. Create the model

### Local models (`model.json`)

Create `packages/cms/src/slices/<Name>/model.json`. `<Name>` is PascalCase (`InfoCardList`); the slice `id` inside the file is snake_case (`info_card_list`) and is what Prismic and the code use to refer to it.

```json
{
  "id": "my_slice",
  "type": "SharedSlice",
  "name": "MySlice",
  "description": "One-line description of what this slice is for",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "https://prismic.io/docs/slices",
      "version": "initial",
      "description": "Default variation",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "single": "heading2,heading3", "label": "Heading", "placeholder": "" }
        }
      },
      "items": {
        "label": {
          "type": "Text",
          "config": { "label": "Label", "placeholder": "" }
        }
      }
    }
  ]
}
```

Copy a small existing slice's `model.json` as a starting point (e.g. `InfoCardList` for a simple repeatable list, `Callout`'s history for `primary`-only fields) rather than writing one from scratch.

### Type Builder

In the Prismic dashboard: **Slices → Create a slice**, name it (PascalCase display name; Prismic derives the snake_case API id), add a `default` variation, and add fields under **Primary** and **Items** using the same field-type choices as below. There is no local file to create — the live model *is* the source of truth.

### Field types you'll use

| Need | Field type | Notes |
| --- | --- | --- |
| A short string (title, label) | Text | |
| Formatted text (paragraphs, bold, links, lists) | Rich Text (`StructuredText`) | Restrict `multi`/`single` to the block types you actually need |
| A toggle | Boolean | **Always set a default** — see [Field defaults](#field-defaults-matter) |
| A URL, page link or file | Link | Set `allowTargetBlank` if it may open in a new tab |
| An image | Image | |
| A fixed set of choices | Select | |
| A repeated group of fields **on `primary`** | Group | Allowed on `primary`; **not** inside `items` (see below) |

### The flat-field limit

**A Group cannot contain another Group, and a repeatable `items` zone cannot hold a Group.** So "a list of sections, each with a list of files" cannot be one nested structure. Two ways around it:

- **Flat numbered fields:** `file_1_label` / `file_1` / `file_1_size`, `file_2_label` / `file_2` / `file_2_size`, … — capped at however many slots you add. Used by this project's Accordion for its download buttons.
- **One slice instance per unit:** if "one section = one slice" fits your content (like the old `DisclosureList`), each instance's `items` group is then a plain (non-nested) list.

### Field defaults matter

A field that doesn't exist yet on a document reads as empty text, `false` for Boolean, `null` for Number. **Pick the field's meaning so that "unset" is the behaviour you want on existing content.** For example, this project's Accordion needed "start collapsed unless configured otherwise" — the field is named `start_expanded` (default `false`), not `start_collapsed`, so every existing page (which has no value) keeps behaving as before once the field is added.

## 2. Build the component

Create `packages/cms/src/slices/<Name>/index.tsx`:

```tsx
import { Content, isFilled } from "@prismicio/client";
import { PrismicRichText, SliceComponentProps } from "@prismicio/react";

export type MySliceProps = SliceComponentProps<Content.MySliceSlice>;

export default function MySlice({ slice }: MySliceProps) {
  return (
    <section
      data-slice-type={slice.slice_type}
      data-slice-variation={slice.variation}
    >
      <PrismicRichText field={slice.primary.heading} />
      {slice.items.map((item, index) => (
        <p key={`${item.label}-${index}`}>{item.label}</p>
      ))}
    </section>
  );
}
```

- **Always render `data-slice-type` / `data-slice-variation`** on the root element — it's this project's convention for debugging and e2e hooks.
- **Guard optional fields** with `isFilled.richText(...)` / `isFilled.link(...)` before rendering them.
- **Use `ui` primitives** (`Card`, `Button`, `ChevronLink`, the accordion, …) for anything that already has a shared component. Don't render another slice inside this one — a slice can only sit in a slice zone, never nested (see [slices/README.md](../packages/cms/src/slices/README.md#composing-a-slice-use-ui-primitives-never-other-slices)).
- **Server component by default.** Only add `"use client"` if the slice genuinely needs local state (see `FaqAnswerSwap` for an example of when that's warranted).
- If the design needs off-palette colours or repeated Tailwind class strings, put them in a `styles.ts`/theme token rather than copy-pasting — see the Accordion's `styles.ts` and `InfoBox.tsx`.

## 3. Register the slice

1. **`SliceRenderer.tsx`** — import the component and add it to the registry map: `my_slice: MySlice,`. Without this, the slice renders as an "Unmapped Slice" warning box (or nothing, depending on the renderer).
2. **Page-type slice zones** — add `my_slice` to every zone it should be allowed in.
   - *Local models:* edit `packages/cms/customtypes/content_page/index.json`, adding `"my_slice": { "type": "SharedSlice" }` under the relevant zone(s) (`heading`, `main`, `aside`, `footer`).
   - *Type Builder:* open the page custom type, go to the zone, and add the slice from the picker.

## 4. Generate types

Local models: run `pnpm types` (in `packages/cms`, or from the repo root — see `package.json`). This runs `prismic-ts-codegen` against every `model.json` and regenerates `prismicio-types.d.ts`, giving you `Content.MySliceSlice`. **Never hand-edit that file.**

Type Builder: regenerate the same way, whatever your project's codegen command is (see the project's `prismic.agent.md` "Project facts" table if it has one) — the live model is read from Prismic instead of local files.

## 5. Push the model (local models only)

If you're working from local `model.json` files, the model isn't live in Prismic until pushed. **Never run a bare `prismic push`** — it treats local files as the source of truth and will delete any remote type or slice that isn't present locally, and overwrite any that differ.

Safe sequence:

```bash
cd packages/cms
npx prismic status        # read the "Next:" line — must be create 0, delete 0 (or only what you intend)
npx prismic push          # only if status confirms that
```

If `status` reports differences you didn't make, or a push would delete/update things outside your change, stop and ask before proceeding — see [creating-a-slice.md → prismic.agent.md](real-project-prismic.agent.md) for the full guardrails an agent should follow here, and [prismic-mcp.md](prismic-mcp.md) for how this project's Prismic MCP tools map to this workflow.

Type Builder projects skip this step — there's nothing to push.

## 6. Add content and check it

1. Add the slice to a document in Prismic. For anything on a **published** document, use a **Release** (create it, edit inside it, present it for review) rather than editing the live document directly.
2. Confirm the page renders: check the Tailwind classes actually apply (a monorepo needs the slice's package listed under `@source` in `apps/frontend/app/globals.css`, or its classes silently don't generate), and compare against the design using measured values (DevTools padding/margin/font-size), not by eye.
3. Publish the Release once it looks right.

## 7. Document it

Add `packages/cms/src/slices/<Name>/README.md` covering: when to use it / when not to, its fields (a table, grouped if there are many), an example JSON payload, rendering/behaviour notes, styling conventions (with the source of any measured values), known limitations, and related slices. Add a row for it to the index in [slices/README.md](../packages/cms/src/slices/README.md).

## Steps for a Type Builder project (e.g. the real project)

This project's steps above assume local `model.json` files. A project using Prismic's **Type Builder** (model managed in the dashboard, not in local files) follows the same shape, with these substitutions. Fill in the `<…>` placeholders once for your project (they belong in that project's `prismic.agent.md` "Project facts" table, if it has one, so you only work them out once):

| Step | Local models (this repo) | Type Builder project |
| --- | --- | --- |
| 1. Model | Create `packages/cms/src/slices/<Name>/model.json` | Create the slice and its fields in the **Prismic dashboard** (Slices → Create a slice → add fields under Primary/Items). There is no local model file — the live model is the source of truth. |
| 2. Component | `<slices folder>/<Name>/index.tsx`, `SliceComponentProps<Content.<Name>Slice>` | Same shape, in `<that project's slice components folder>`. Confirm the import path for shared UI components — `ui` here may be `@/components/ui/...` or similar there. |
| 3. Register | `SliceRenderer.tsx` + `customtypes/content_page/index.json` | `<that project's slice registry file>` + the page custom type's slice zones — the file names and structure will likely differ; check with `get_custom_type` / the dashboard rather than assuming they match this repo. |
| 4. Types | `pnpm types` (`prismic-ts-codegen` reading local `model.json` files) | `<that project's codegen command>`, which must read the **live** Prismic model instead of local files — confirm the command before assuming it needs no change. |
| 5. Push the model | `prismic status` → `prismic push` (never bare) | **Skipped** — nothing to push; the dashboard change is already live once saved. |

Everything else (before-you-start questions, field types, the flat-field limit, field defaults, adding content through a Release, documenting the slice) applies unchanged.

If an agent is doing this work, it should refuse to guess the blanks above and ask instead — see [real-project-prismic.agent.md](real-project-prismic.agent.md)'s "Ask the developer first" section.

## Checklist

- [ ] Answered the "before you start" questions (what varies, primary/items, variation vs new slice, zones, defaults)
- [ ] Model created (local `model.json` or Type Builder) with stable, well-chosen field API ids
- [ ] Component built from `ui` primitives, with `data-slice-type`/`data-slice-variation` and `isFilled` guards
- [ ] Registered in `SliceRenderer.tsx` and the page type's zone(s)
- [ ] Types regenerated (`pnpm types`), `pnpm -r typecheck` passes
- [ ] Model pushed to Prismic (local models only) via the safe `status` → `push` sequence — never a bare push
- [ ] Content added through a Release, checked against the design, then published
- [ ] Slice README written; added to the slice index

## Related

- [accordion-slice-guide.md](accordion-slice-guide.md) — a full worked example, including cards, download buttons, and Roman-numeral lists.
- [packages/cms/src/slices/README.md](../packages/cms/src/slices/README.md) — conventions used across every slice in this project.
- [prismic-mcp.md](prismic-mcp.md) — how this project uses the Prismic MCP.
- [real-project-prismic.agent.md](real-project-prismic.agent.md) — a portable Copilot agent covering this same workflow, for a Type Builder project.
