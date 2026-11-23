import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodType } from 'zod';

// One level above the chat model (Haiku in AnthropicLlmProvider): it generates the dataset and judges replies.
const MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 4096;

/** What the eval needs from a model: instructions in, schema-validated object out. */
export interface EvalLlm {
  completeJson<T>(request: { system: string; user: string }, schema: ZodType<T>): Promise<T>;
}

/** Reads ANTHROPIC_API_KEY from the environment (see loadDotEnv). */
export class AnthropicEvalLlm implements EvalLlm {
  private readonly client = new Anthropic();

  async completeJson<T>({ system, user }: { system: string; user: string }, schema: ZodType<T>): Promise<T> {
    const message = await this.client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (message.parsed_output == null) throw new Error('Model returned no structured output');
    return message.parsed_output;
  }
}
