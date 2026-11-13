import { z } from 'zod';

export const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    LLM_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
    ANTHROPIC_API_KEY: z.string().optional(),
    MODEL_DEFAULT: z.string().min(1).default('claude-sonnet-5-5'),
    MODEL_FAST: z.string().min(1).default('claude-haiku-5-5'),
    MAX_AGENT_STEPS: z.coerce.number().int().positive().default(8),
  })
  .refine((env) => env.LLM_PROVIDER !== 'anthropic' || !!env.ANTHROPIC_API_KEY, {
    path: ['ANTHROPIC_API_KEY'],
    message: 'required when LLM_PROVIDER=anthropic',
  });

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  // empty strings in .env (e.g. `ANTHROPIC_API_KEY=`) count as unset
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
