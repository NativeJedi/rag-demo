import { z } from 'zod';

export const CaseSchema = z.object({
  id: z.string(),
  category: z.string(),
  input: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
});
export type Case = z.infer<typeof CaseSchema>;

export const DatasetSchema = z.array(CaseSchema);

/** What the generator asks the model for (ids and category are added in code). */
export const GeneratedSchema = z.object({
  cases: z.array(CaseSchema.pick({ input: true, criteria: true })),
});
