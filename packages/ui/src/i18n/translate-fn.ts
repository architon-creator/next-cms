/**
 * Minimal structural type for "a translation function scoped to one
 * namespace" — matches what next-intl's useTranslations("SomeNamespace")
 * returns, without packages/ui depending on next-intl itself (see
 * calendar/mini-calendar.tsx's comment for why that's a real problem
 * under strict pnpm, not a hypothetical one).
 *
 * Every shared component that needs translated copy takes a `t: TranslateFn`
 * prop and calls it directly (`t("today")`, `t("selected", { date })`)
 * instead of a bespoke `labels={{ ... }}` object — so adding a new
 * component never needs its own mapping code at the call site, just
 * `<Foo t={useTranslations("Foo")} />`. The component's own
 * `./messages/en.json` (see calendar/messages/en.json for the pattern)
 * still defines which keys it expects; that's the contract between the
 * component and whoever calls it, same as before.
 */
export type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
