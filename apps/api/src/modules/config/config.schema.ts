import { z } from 'zod';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().min(1),
  /** File name inside apps/api/prompts/ used as the chat system prompt (evals set it to compare prompts). */
  SYSTEM_PROMPT_FILE: z.string().default('system.md'),
  /** Vocabulary dictionary JSON file; a relative path is resolved from apps/api. */
  DICTIONARY_FILE: z.string().default('data/dictionary.json'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  // empty strings in .env (e.g. `PORT=`) count as unset
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
