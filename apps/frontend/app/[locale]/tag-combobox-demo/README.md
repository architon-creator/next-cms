# Tag combobox demo — issues found

This page reproduces the real project's (`nexuz-ui`) `FieldComboboxChips` usage from
its tag filter bar, to debug two issues found there. `controlled-tag-filter-demo.tsx`
now holds the **fixed** version; this doc is what to port back.

## Issue 1: open state had two conflicting sources of truth

**Symptom:** clicking the trigger/chevron with an empty search box opened nothing.
Typing a character would finally open it, and clearing the query back to empty while
open would close it again mid-interaction.

**Cause:** `open` is externally controlled, so `onOpenChange` is supposed to be the
only thing that sets it — driven by the trigger's click/escape/outside-click
behavior. But the real code's `onInputValueChange` handler also wrote to the same
state, gated on whether there was search text:

```tsx
onInputValueChange={(value) => {
  const nextValue = value ?? "";
  setTagSearchQuery(nextValue);
  setIsTagDropdownOpen(nextValue.trim().length > 0); // conflicts with onOpenChange
}}
```

Since `onInputValueChange` only fires once something is typed, nothing ever set
`isTagDropdownOpen(true)` on a plain trigger click with no query yet.

**Fix:** drop the `setIsTagDropdownOpen` call from `onInputValueChange` — it should
only update the search text. Let `onOpenChange={setIsTagDropdownOpen}` be the sole
driver of open state:

```tsx
onInputValueChange={(value) => setTagSearchQuery(value ?? "")}
```

## Issue 2: remove icon missing from `chipsPlacement="below"` badges

**Symptom:** selected-tag badges rendered below the input (not inside it) had no
visible remove affordance — just the tag text, no `X` icon — even though
`aria-label={`Remove ${tag}`}` was present, so it only read as removable to
assistive tech, not visually.

**Cause:** this demo made the identical mistake first while reproducing the
pattern — the `chipsPlacement === "below"` block's `<button>` rendered `{tag}` with
no icon child. Worth checking the real project's equivalent block for the same gap.

**Fix:** render an `XIcon` (or the project's `Icon` equivalent) inside the button,
after the tag text:

```tsx
<button type="button" onClick={...} aria-label={`Remove ${tag}`} className="...">
  {tag}
  <XIcon className="size-3.5 opacity-70 hover:opacity-100" />
</button>
```

## Why both were easy to miss

Neither breaks the happy path (type to filter → click a result), so they only
surface when someone specifically tries "open with no query yet" or looks closely
at a below-placement badge for a visible remove control.

## Files here

| File | Purpose |
| --- | --- |
| `tag-combobox-demo-client.tsx` | `TagCombobox` (uncontrolled open/search state) over a flat tag list. |
| `controlled-tag-filter-demo.tsx` | Fixed version of the real project's controlled `open`/`inputValue` pattern — port this shape back. |
| `page.tsx` | Renders both side by side for comparison. |
