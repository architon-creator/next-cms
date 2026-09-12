export const STEP_ORDER = [
  "personal-details",
  "contact-info",
  "preferences",
  "documents",
  "review-submit",
] as const;

export type StepId = (typeof STEP_ORDER)[number];

// The 4 data-entry steps reviewed/confirmed on review-submit — excludes
// review-submit itself, which has no form data or confirmation of its own.
export const DATA_STEP_ORDER = STEP_ORDER.filter(
  (step): step is DataStepId => step !== "review-submit",
);

export type DataStepId = Exclude<StepId, "review-submit">;

export function isStepId(value: string): value is StepId {
  return (STEP_ORDER as readonly string[]).includes(value);
}

export function stepIndexFromPathname(pathname: string): number {
  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  return STEP_ORDER.findIndex((step) => step === segment);
}

export function previousStep(stepId: StepId): StepId | null {
  const index = STEP_ORDER.indexOf(stepId);
  return index > 0 ? STEP_ORDER[index - 1] : null;
}

export function nextStep(stepId: StepId): StepId | null {
  const index = STEP_ORDER.indexOf(stepId);
  return index >= 0 && index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1] : null;
}
