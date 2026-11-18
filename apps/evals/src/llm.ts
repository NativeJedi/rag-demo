import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';

/** One prompt in, the whole text reply out. */
export async function ask(llm: LlmProvider, system: string, user: string): Promise<string> {
  let text = '';
  const messages = [{ role: 'user' as const, content: user }];
  for await (const event of llm.stream({ messages, system }, new AbortController().signal)) {
    if (event.type === 'text_delta') text += event.text;
    if (event.type === 'error') throw new Error(event.message);
  }
  return text;
}
