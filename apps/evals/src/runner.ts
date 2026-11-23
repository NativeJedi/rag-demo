import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { Case } from './dataset';

export interface RunResult {
  case: Case;
  reply: string;
}

/** Runs the cases one by one. Any provider error aborts the whole eval: a score over partial data would be misleading. */
export async function runCases(cases: Case[], reply: (input: string) => Promise<string>): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const c of cases) results.push({ case: c, reply: await reply(c.input) });
  return results;
}

/** The chat's whole reply to one user message, collected from its stream (the provider owns the system prompt). */
export async function collectReply(llm: LlmProvider, input: string): Promise<string> {
  let reply = '';
  for await (const event of llm.stream({ messages: [{ role: 'user', content: input }] }, new AbortController().signal)) {
    if (event.type === 'text_delta') reply += event.text;
    else if (event.type === 'error') throw new Error(event.message);
  }
  return reply;
}
