import { z } from 'zod';
import { StopReasonSchema } from './domain.ts';

/**
 * Everything the server can say while an assistant turn is running.
 * Adding a member means updating the provider, the ChatService and the web chatReducer together.
 */
export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message_start'), messageId: z.string() }),
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('message_done'), stopReason: StopReasonSchema }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;
export type ChatEventType = ChatEvent['type'];
