import { z } from 'zod';

export const CaseSchema = z.object({
  id: z.string(),
  category: z.string(),
  input: z.string(),
  criteria: z.array(z.string()),
});
export type Case = z.infer<typeof CaseSchema>;

export const DatasetSchema = z.array(CaseSchema);
