# Migrating local locale JSON (ja, th, ko, zh) into Prismic

This guide explains how to take a customer-supplied locale file (for example `ja.json`) and load it into Prismic, page by page, using the standalone script
[packages/cms/scripts/migrate-locale-labels.ts](../packages/cms/scripts/migrate-locale-labels.ts).

## The idea in one minute

Today our labels live in local files, one per language:

```
apps/frontend/messages/en.json
apps/frontend/messages/ja.json
```

Each top-level key is a **page** (a "namespace"):

```json
{
  "HomePage": { "title": "Welcome", "description": "..." },
  "LoginPage": { "title": "Sign in", "description": "..." }
}
```

In Prismic, each page is one **document** of a custom type (`HomePage` -> `home_page`), and every language is a **translation of the English document**.

```
home_page (en-us)  <--- master
   |-- home_page (ja-jp)   <--- created by this script
   |-- home_page (ko-kr)
   |-- home_page (th-th)
```

The script reads the customer's file and creates (or updates) those translated documents. It also links them from the `app_labels` hub document in the same language, so the frontend can find them.

## Seed script vs migrate script

Two scripts write to Prismic. They do different jobs:

| | `seed-prismic-content-demo.ts` | `migrate-locale-labels.ts` |
| --- | --- | --- |
| Purpose | First load of the English labels from `en.json` | Add translations (ja, th, ko, zh-tw, zh-cn) from a customer file |
| Language | English (`en-us`) only | Chosen with `--locale` |
| Input | Always `apps/frontend/messages/en.json` | Any file passed with `--file` |
| Documents | Creates the English documents | Creates translations linked to the English ones (alternate languages) |
| Needs English first? | No, it creates it | Yes, a page with no published English document is an error |
| Hub (`app_labels`) | English hub with links | Hub for the target language only |
| Checks | Almost none | Placeholders, string-only values, locale enabled, duplicate guard, `--strict` |
| Page selection | All pages | All pages, or some with `--page` |

Order for a new page: generate the custom type (`prismic-model-generate`), seed English and publish it, then run the migrate script for each language.

## Supported languages

| Language | `--locale` | File name to ask the customer for | Prismic locale |
| --- | --- | --- | --- |
| Japanese | `ja` | `ja.json` | `ja-jp` |
| Thai | `th` | `th.json` | `th-th` |
| Korean | `ko` | `ko.json` | `ko-kr` |
| Chinese (Traditional) | `zh-tw` | `zh-TW.json` | `zh-tw` |
| Chinese (Simplified) | `zh-cn` | `zh-CN.json` | `zh-cn` |

The mapping is the `LOCALE_MAP` constant at the top of the script. If your Prismic repo uses different codes, change it there.

## Before you start (one-time checks)

1. **English is already in Prismic.** The script attaches each translation to the English document. A page with no English document is skipped.
2. **The language is enabled in Prismic.** Repository settings -> Translations & locales -> add the language (e.g. Japanese `ja-jp`).
3. **Custom types exist** for every page you want to migrate: `packages/cms/customtypes/<page_name>/index.json`. Pages without one are skipped (the script tells you).
4. **Environment variables** are set in `.env.local` (repo root or `packages/cms`):
   - `PRISMIC_REPOSITORY_NAME`
   - `PRISMIC_ACCESS_TOKEN`
   - `PRISMIC_WRITE_TOKEN` (needed only for `--write`)

## Step by step

All commands run from `packages/cms`.

### Step 1 - Get the customer file in the right shape

It must have the **same structure as `en.json`**: same page names, same keys, only the text translated.

- Put it somewhere outside the app, e.g. `packages/cms/incoming/ja.json`, or use `apps/frontend/messages/ja.json`.
- It must be valid JSON (an editor will highlight errors).
- Placeholders such as `{year}` must be kept exactly as in English.

### Step 2 - Do a dry run (changes nothing)

```bash
npx tsx scripts/migrate-locale-labels.ts --locale ja --file ../../apps/frontend/messages/ja.json
```

Example output:

```
[dry run] Would migrate 8 page(s) to ja-jp (--locale ja):
  create header - "Header"
  create home_page - "Home Page"
    missing in file, existing translation kept (English if none): description
  update login_page - "Login Page"
    not in Prismic model, ignored: legacyTitle
```

How to read it:

| Output | Meaning | What to do |
| --- | --- | --- |
| `create` | No translation exists yet; it will be made | Nothing |
| `update` | A translation exists; its text will be overwritten | Make sure that is intended |
| `missing in file, existing translation kept (English if none)` | The customer forgot this key | Ask them for it, or accept English |
| `not in Prismic model, ignored` | The file has a key Prismic has no field for | Usually a typo or extra key; ask the customer |
| `[Page] ... skipped` | Missing English doc, missing custom type, or page not in file | Fix the cause (see checks above) |

Nothing is written during a dry run, so run it as often as you like.

### Step 3 - Try one page first (recommended)

```bash
npx tsx scripts/migrate-locale-labels.ts --locale ja --file ../../apps/frontend/messages/ja.json --page HomePage --write
```

`--page` takes the page names from the JSON, comma-separated (`HomePage,LoginPage`). Open Prismic and check the new `ja-jp` document looks right.

### Step 4 - Migrate everything

```bash
npx tsx scripts/migrate-locale-labels.ts --locale ja --file ../../apps/frontend/messages/ja.json --write
```

The script runs in two passes:

1. Creates/updates each page's translated document.
2. Creates/updates the `app_labels` hub in `ja-jp` and links it to those documents. Existing links for pages not in this run are kept.

### Step 5 - Publish and verify

The documents are written into a **Migration Release** in Prismic. Open it in the dashboard, review the documents, and publish the release. Do this before running the script again for the same language, otherwise it will refuse to run (see "Built-in safety checks"). Then open the site in that language (e.g. `/ja`) and confirm the labels appear.

### Step 6 - Repeat for the other languages

```bash
npx tsx scripts/migrate-locale-labels.ts --locale th    --file ./incoming/th.json    --write
npx tsx scripts/migrate-locale-labels.ts --locale ko    --file ./incoming/ko.json    --write
npx tsx scripts/migrate-locale-labels.ts --locale zh-tw --file ./incoming/zh-TW.json --write
npx tsx scripts/migrate-locale-labels.ts --locale zh-cn --file ./incoming/zh-CN.json --write
```

Always dry-run each one first.

## Built-in safety checks

The script stops with exit code 1 and writes nothing if any of these fail (a dry run reports them too, so it can be used as a check before sending a file back to the customer):

- A value in the file is not a string (for example a number or a nested object).
- A `{placeholder}` in English (like `{year}`) is missing or changed in the translation.
- The target language is not enabled in the Prismic repository.
- The English document has not been published in Prismic.
- A previous run already wrote this document but it has not been published yet. Prismic keeps new documents in a **Migration Release**, which the script cannot see, so it refuses to create a duplicate. Publish the release in Prismic, then run again. The script remembers its writes in `packages/cms/.locale-migration-state.json` (git-ignored).

Warnings (the run continues): keys missing from the file, empty translations, keys not in the Prismic model, and pages skipped because they have no custom type.

## What happens when keys are missing from the customer file

By default a missing key is a **warning**, and the run continues:

- If the Japanese document does not exist yet, that field gets the **English** text.
- If the Japanese document already exists, the **existing translation is kept** (it is never overwritten with English).

Either way the dry run lists them under `missing in file`. A missing key can therefore leave English text on a Japanese page, so check those lines before `--write`.

To refuse an incomplete file, add `--strict`. Every missing key becomes an error, nothing is written, and the exit code is 1:

```bash
npx tsx scripts/migrate-locale-labels.ts --locale ja --file ./ja.json --strict           # check completeness
npx tsx scripts/migrate-locale-labels.ts --locale ja --file ./ja.json --strict --write   # migrate only if complete
```

`--strict` checks missing keys only. A page missing from the file, or with no custom type, is still just a warning.

## Common scenarios

**The customer sends a corrected `ja.json` later.** Run the same command again. Existing documents are updated, nothing is duplicated.

**Only the Login page changed.** Add `--page LoginPage` so other pages are untouched.

**A new page is added to the app.** Add its custom type and English document first, then migrate the languages.

**Customer file is missing some pages.** Those pages are reported as "missing in file" and skipped; other pages still migrate.

## Options reference

| Option | Required | Description |
| --- | --- | --- |
| `--locale` | yes | `ja`, `th`, `ko`, `zh-tw`, `zh-cn` |
| `--file` | yes | Path to the customer's locale JSON |
| `--page` | no | Comma-separated page names to migrate only those |
| `--master` | no | English JSON to compare against (default `apps/frontend/messages/en.json`) |
| `--write` | no | Actually write to Prismic. Without it, it is a dry run |
| `--strict` | no | Treat keys missing from the customer file as errors (nothing is written). Use it to insist on a complete file |
| `--force-create` | no | Create a document even though a previous run already wrote it unpublished (can create duplicates; avoid) |

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| `Unsupported --locale` | Typo; use one of the codes in the table above |
| `PRISMIC_WRITE_TOKEN is required` | Token missing from `.env.local` (only needed with `--write`) |
| Page skipped: no `en-us` document | Migrate English first |
| Page skipped: no custom type | Generate the custom type (`pnpm --filter cms prismic-model-generate`) |
| Prismic rejects the locale | The language is not enabled in repository settings |

## Limits to know about

- Only plain **Text** fields on the model's `Main` tab are handled (this matches how the current labels are modelled). Rich text, groups and images would need script changes.
- The script overwrites the text of existing translated documents with the file's values.
