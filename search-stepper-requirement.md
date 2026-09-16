# Requirement: Search → Results → Multi-Step Form

## 1. Landing Page (`localhost:3000`)

- Page heading + search input field(s) (placeholder search criteria until domain-specific fields are defined)
- **"Search" button** — submits the search and renders results **on the same page** (no navigation to a separate route)
- Results list/grid appears below/in place after search submission
  - Each result item shows a summary (e.g. name, key details, thumbnail if relevant)
  - Each result item has a **"Select" / "Continue"** action
- **Empty state:** a clear message shown if the search yields no results (e.g. "No results found — try adjusting your search")

## 2. Flow Trigger

Clicking **"Select" / "Continue"** on a chosen result item navigates to `personal-details` and starts the 5-step stepper flow at Step 1.

_(Note: the flow does not start on the "Search" button click itself — it starts only after a result is selected.)_

## 3. Steps & Routes

| Step | Route               | Label            |
| ---- | ------------------- | ---------------- |
| 1    | `/personal-details` | Personal Details |
| 2    | `/contact-info`     | Contact Info     |
| 3    | `/preferences`      | Preferences      |
| 4    | `/documents`        | Documents        |
| 5    | `/review-submit`    | Review & Submit  |

## 4. Stepper Visual States

| Symbol | State     | Meaning                                            |
| ------ | --------- | -------------------------------------------------- |
| ●      | Current   | The step the user is actively on                   |
| ✓      | Visited   | A step already passed through, in either direction |
| ○      | Unvisited | A step not yet reached                             |

The stepper is **non-interactive / display-only** — no click-to-jump on individual steps.

## 5. Navigation Behavior

- In-page **Next / Back** buttons drive all navigation between steps — not the stepper itself
- Moving forward: the step being left is marked **visited**; the new step becomes **current**
- Moving backward: the step being returned to becomes **current** again; the step left behind **remains visited** (never reverts to unvisited)
- **"Review & Submit" (Step 5) is terminal** — there is no page or action after it

## 6. Form Handling, Validation, State & Persistence

**Tech stack:**

- **React Hook Form** — form state and field handling on each step page
- **Zod** — schema-based validation, wired via `@hookform/resolvers/zod`
- **Redux Toolkit** — global store holding form data across all 5 steps, plus section-confirmation state (from Section 7)
- **redux-persist** — persists the Redux store (e.g. to `localStorage`) so data survives page refresh and back/forward navigation

**Data retention behavior:**

- On clicking **"Next"** (or **"Save & Return"** in change flow), the current page's form data is validated, then dispatched into the Redux store under that step's slice (e.g. `formData.personalDetails`)
- Navigating **back** to a previously completed step re-populates that step's form fields from the store — nothing is lost or reset
- Because the store is persisted, refreshing the browser or closing/reopening the tab mid-flow retains all previously entered data (subject to the Route Guard in Section 8 — the user still can't skip ahead, but their already-entered data for reached steps is preserved)
- `redux-persist` should whitelist only the form-data slice (and section-confirmation slice); avoid persisting anything transient/UI-only

**Basic validation (per step, via Zod schemas):**

- Required-field checks on all mandatory inputs
- Format validation where applicable (e.g. email format, phone number pattern)
- Inline error messages shown per field on invalid submission attempt
- **"Next" / "Save & Return" is blocked** until the current step's Zod schema validates successfully
- Exact field lists and validation rules per step (Personal Details, Contact Info, Preferences, Documents) are **domain-specific and not yet defined** — placeholder schemas only until actual field requirements are provided

## 7. Review & Submit Page — Section-Level Confirmation & Edit

The Review & Submit page displays a summary of all 4 prior steps, grouped by section. **Each section has its own "Confirm" button and its own "Change" button**, separate from the final page-level Submit action.

- Sections shown: Personal Details, Contact Info, Preferences, Documents
- Each section summarizes the data entered in that step, plus two actions:
  - **"Confirm"** — marks the section as reviewed/approved (visually distinguished, e.g. a checkmark or "Confirmed" badge)
  - **"Change"** — navigates directly to that section's own page (e.g. clicking "Change" on Preferences goes to `/preferences`), so the user can edit it
- A section can be edited after confirming — editing should reset that section's confirmed state until re-confirmed (**open item:** confirm this is the intended behavior)
- The final **"Submit"** button is only enabled once **all 4 sections are confirmed**
- **Assumption:** "Confirm" is a client-side review acknowledgment (no data is sent to a backend per section) — only the final Submit sends the complete data. Flag if per-section confirmation should also persist/save independently.

**Stepper sync on "Change":** clicking "Change" for a section follows the same navigation rules already defined in Section 5 (Navigation Behavior) —

- The target step (e.g. Preferences) becomes **current** (●)
- Review & Submit (the step being left) becomes **visited** (✓), not unvisited, since it was already reached
- All steps in between remain **visited**, since they were already passed through on the way to Review & Submit
- The stepper indicator updates immediately to reflect this new current step, exactly as it would from a Back button click

**Distinguishing initial flow vs. change flow:** clicking "Change" appends a query parameter to the target route, e.g. `/preferences?from=review`.

- Step pages check for `from=review`:
  - **Present** → edit/change flow. The page's primary button becomes **"Save & Return"** instead of "Next," and navigates directly back to `/review-submit` (skipping remaining sequential steps)
  - **Absent** → normal initial flow. Primary button remains **"Next"** and proceeds to the next step in sequence
- The query param persists across a refresh, so reloading mid-edit doesn't fall back to initial-flow behavior
- The "Back" button's behavior is unaffected by this parameter — it always goes to the previous step in sequence, in both flows

## 8. Route Guard — Restrict Direct Navigation

Users must not be able to skip ahead by typing a step URL directly.

- On each step page load, check whether the user has legitimately reached that step (i.e. the required prior steps in the sequence have been completed)
- If a user directly navigates to a step URL they haven't reached yet (e.g. typing `/documents` without completing Personal Details, Contact Info, and Preferences first) → **redirect to the landing/search page** (`/`)
- Navigating to a step already reached (current or visited) via direct URL/refresh is allowed and shows that step normally, per the existing "Direct navigation or refresh" behavior
- This check applies only to _skipping ahead_; revisiting an earlier, already-visited step is not restricted

## 9. Content / Localization (`en.json`)

All user-facing copy must be sourced from `messages/en.json` (existing next-intl setup) rather than hardcoded in components. New keys follow the project's existing convention: **top-level keys are PascalCase, matching the page or component name**; sub-keys are camelCase.

```json
{
  "SearchPage": {
    "heading": "Find what you're looking for",
    "searchButton": "Search",
    "emptyState": "No results found — try adjusting your search"
  },
  "ResultCard": {
    "selectAction": "Select",
    "continueAction": "Continue"
  },
  "Stepper": {
    "personalDetails": "Personal Details",
    "contactInfo": "Contact Info",
    "preferences": "Preferences",
    "documents": "Documents",
    "reviewSubmit": "Review & Submit"
  },
  "StepNavigation": {
    "next": "Next",
    "back": "Back",
    "submit": "Submit",
    "saveAndReturn": "Save & Return"
  },
  "PersonalDetailsPage": {
    "title": "Personal Details"
  },
  "ContactInfoPage": {
    "title": "Contact Info"
  },
  "PreferencesPage": {
    "title": "Preferences"
  },
  "DocumentsPage": {
    "title": "Documents"
  },
  "Validation": {
    "required": "This field is required",
    "invalidEmail": "Please enter a valid email address",
    "invalidPhone": "Please enter a valid phone number"
  },
  "ReviewSubmitPage": {
    "title": "Review & Submit",
    "confirmSection": "Confirm",
    "changeSection": "Change",
    "confirmedBadge": "Confirmed",
    "submit": "Submit"
  }
}
```

- Each key block is merged into the existing `messages/en.json`, alongside `Header`, `Footer`, `HomePage`, etc. — not a separate file
- Components use `useTranslations("Stepper")`, `useTranslations("SearchPage")`, etc., matching how `LoginForm` and `ContactPage` already consume their namespaces
- **Open item:** confirm whether routes in this project are locale-prefixed (e.g. `app/[locale]/personal-details`) or flat (`app/personal-details`) — check the `i18n/` folder's routing config before creating the step route folders, so they land in the right place

## 10. Acceptance Criteria

- [ ] Search and results render on the same landing page — no separate `/results` route
- [ ] Search input accepts criteria and triggers a results render on submit
- [ ] Each result item has a selectable action that initiates the stepper flow
- [ ] Empty state is handled when search yields no results
- [ ] Stepper renders 5 labeled steps; current/visited/unvisited state is derived from the active route (not just local component state)
- [ ] Stepper has no click handlers on individual steps
- [ ] Forward and backward in-page navigation correctly update step states
- [ ] A visited step never reverts to unvisited
- [ ] Direct navigation or a page refresh on any step route shows the correct current step
- [ ] "Review & Submit" is the final step — no further page or action beyond it
- [ ] Data entered on any step is retained in the Redux Toolkit store when "Next" (or "Save & Return") is clicked
- [ ] Navigating back to a previous step re-populates its fields from the store, not blank fields
- [ ] Form data persists across a page refresh or tab reopen via redux-persist
- [ ] Each step's fields are validated via Zod schema (through React Hook Form) before allowing "Next" / "Save & Return"
- [ ] Required-field and format validation errors display inline per field
- [ ] All UI copy (headings, button labels, stepper labels, empty state message) is sourced from `en.json`, not hardcoded
- [ ] Directly navigating to a step URL beyond the user's reached progress redirects to the landing page
- [ ] Directly navigating/refreshing on an already-reached (current or visited) step URL works normally, without redirect
- [ ] Review & Submit page shows all 4 prior sections with a summary and a "Confirm" button each
- [ ] Each section also has a "Change" button that navigates directly to that section's own page
- [ ] Clicking "Change" updates the stepper to show that section's step as current, and Review & Submit (and any steps in between) as visited
- [ ] Step pages reached via "Change" (query param present) show "Save & Return" and navigate back to Review & Submit on save, instead of proceeding to the next sequential step
- [ ] Step pages reached via normal forward flow (query param absent) show "Next" and proceed sequentially as usual
- [ ] Refreshing a step page reached via "Change" preserves change-flow behavior (via the query param, not client-only state)
- [ ] Final "Submit" button is disabled until all 4 sections are confirmed
