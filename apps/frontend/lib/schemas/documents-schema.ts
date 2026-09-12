import { z } from "zod";

// Placeholder fields — exact fields for this step are domain-specific and
// not yet defined (see search-stepper-requirement.md section 6).
export const documentsSchema = z.object({
  documentType: z.string().min(1),
  documentNumber: z.string().min(1),
});

export type DocumentsValues = z.infer<typeof documentsSchema>;
