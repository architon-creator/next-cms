import { z } from "zod";

// Placeholder fields — exact fields for this step are domain-specific and
// not yet defined (see search-stepper-requirement.md section 6).
export const contactInfoSchema = z.object({
  email: z.string().min(1).email(),
  phone: z.string().min(1),
});

export type ContactInfoValues = z.infer<typeof contactInfoSchema>;
