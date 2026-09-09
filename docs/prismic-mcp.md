# Using the Prismic MCP Server

This project has the Prismic MCP server connected (configured in [.mcp.json](../.mcp.json)). It lets Claude read and write content directly in your Prismic repository — custom types, shared slices, documents, releases, and assets — without leaving the chat.

## Setup

- Server: `prismic` → `https://mcp.prismic.io/mcp`
- Auth: OAuth, done once per machine via `/mcp` in an interactive session (already connected here).
- If tools stop working (e.g. token expired), re-run `/mcp` and reconnect.

## Available tools

**Discovery**

- `list_repositories` — list Prismic repositories you have access to.
- `list_custom_types` — list custom types (e.g. page, blog_post) in the repo.
- `get_custom_type` — fetch the JSON model for one custom type.
- `list_shared_slices` — list reusable slices registered in Prismic (should mirror [slices/](../slices)).
- `get_shared_slice` — fetch a shared slice's model (fields, variations).
- `get_field_shapes` — inspect the shape/schema of a specific field type.
- `list_locales` — list configured locales for the repo.

**Documents**

- `search_documents` — query documents (by type, tag, field values, etc.).
- `get_document` — fetch a single document by ID.
- `list_document_versions` — see version history for a document.
- `create_document` — create a new document.
- `update_document` — partially update fields on an existing document.
- `replace_document` — overwrite a document's full content.

**Releases**

- `list_releases` — list scheduled/draft releases.
- `create_release` — create a new release (batch of changes to publish together).
- `publish_release` — publish a release.

**Assets**

- `search_assets` — search the media library.
- `upload_asset` — upload a new image/file to the media library.

**Other**

- `submit_feedback` — send feedback to the Prismic MCP team.

## How this maps to the codebase

- [customtypes/](../customtypes) and [prismicio-types.d.ts](../prismicio-types.d.ts) are the local generated mirrors of what `list_custom_types` / `get_custom_type` return from Prismic. If they drift (e.g. after a schema change in the Prismic dashboard), regenerate types as usual (`prismicCodegen.config.ts`) rather than hand-editing the `.d.ts` file.
- [slices/](../slices) holds this project's React implementations of shared slices (`Accordion`, `Callout`, `RichTextSection`, `HeroBanner`, etc.), each with a `model.json`. `get_shared_slice` / `list_shared_slices` let Claude check the live Prismic model matches `model.json` before or after editing a slice.
- When adding a new slice type or field, the usual flow is: update the model in Prismic (via MCP `get_custom_type`/schema tools or the dashboard) → make sure `model.json` and the component in `slices/` match → regenerate `prismicio-types.d.ts`.

## Practical workflows

**Add a new field to a slice and verify it matches Prismic**

1. `get_shared_slice` to pull the current model for the slice.
2. Compare against the local `slices/<Name>/model.json`.
3. Edit `model.json` (and the component) to match, or flag the mismatch.

**Check what content already uses a slice/type before changing it**

1. `search_documents` filtered by custom type.
2. `get_document` on a few results to see real field values in context.

**Publish a batch of content changes together**

1. `create_release`.
2. `create_document` / `update_document` targeting that release.
3. `publish_release` once everything's ready.

**Debug a "why doesn't this render" issue**

1. `get_document` for the page in question.
2. Compare its slice data against what the component in `slices/` expects (check `prismicio-types.d.ts` for the generated type).

## Notes / gotchas

- MCP tool calls hit your live Prismic repo — `create_document`, `update_document`, `replace_document`, and `publish_release` are not local-only actions. Treat them like any other write to shared state: confirm scope before running them, especially `replace_document` (overwrites, doesn't merge) and `publish_release` (goes live).
- `update_document` is safer than `replace_document` for partial edits since it merges rather than replaces.
- This doc reflects the tools available at the time of writing (2026-09-08). If Prismic adds/renames MCP tools, ask Claude to re-check the current list rather than trusting this file blindly.
