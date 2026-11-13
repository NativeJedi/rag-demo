import { z } from 'zod';
import { CitationSchema, StopReasonSchema } from './domain';

export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message_start'), messageId: z.string(), model: z.string() }),
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('thinking_delta'), text: z.string() }),
  z.object({ type: z.literal('tool_call_start'), toolUseId: z.string(), name: z.string() }),
  z.object({ type: z.literal('tool_call_delta'), toolUseId: z.string(), partialJson: z.string() }),
  z.object({ type: z.literal('tool_call'), toolUseId: z.string(), name: z.string(), input: z.unknown() }),
  z.object({ type: z.literal('tool_result'), toolUseId: z.string(), output: z.unknown(), isError: z.boolean() }),
  CitationSchema.extend({ type: z.literal('citation') }),
  z.object({
    type: z.literal('usage'),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative().optional(),
    cacheWriteTokens: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal('message_done'), stopReason: StopReasonSchema }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string(), retryable: z.boolean() }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type ChatEventType = ChatEvent['type'];
