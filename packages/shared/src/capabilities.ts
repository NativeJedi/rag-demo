import { z } from 'zod';
import { ModelAliasSchema } from './domain';

export const FeaturesSchema = z.object({
  streaming: z.boolean(),
  tools: z.boolean(),
  attachments: z.boolean(),
  thinking: z.boolean(),
  citations: z.boolean(),
  knowledge: z.boolean(),
  mcp: z.boolean(),
  workflows: z.boolean(),
});
export type Features = z.infer<typeof FeaturesSchema>;

export const CapabilitiesSchema = z.object({
  models: z.array(z.object({ alias: ModelAliasSchema, id: z.string(), label: z.string() })),
  defaults: z.object({
    model: ModelAliasSchema,
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().int().positive(),
  }),
  features: FeaturesSchema,
  provider: z.enum(['mock', 'anthropic']),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
