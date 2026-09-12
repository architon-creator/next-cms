import { z } from "zod";

// Placeholder fields — exact fields for this step are domain-specific and
// not yet defined (see search-stepper-requirement.md section 6).
export const personalDetailsSchema = z.object({
  fullName: z.string().min(1),
  dateOfBirth: z.string().min(1),
});

export type PersonalDetailsValues = z.infer<typeof personalDetailsSchema>;
