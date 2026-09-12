import { z } from "zod";

// Placeholder fields — exact fields for this step are domain-specific and
// not yet defined (see search-stepper-requirement.md section 6).
export const preferencesSchema = z.object({
  contactMethod: z.string().min(1),
  notes: z.string().optional(),
});

export type PreferencesValues = z.infer<typeof preferencesSchema>;
