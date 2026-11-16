import { z } from 'zod';

export const StopReasonSchema = z.enum(['end_turn', 'max_tokens', 'aborted']);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationSummarySchema = ConversationSchema.pick({ id: true, title: true, updatedAt: true });
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/** Plain text in phase 1. Content blocks (thinking, tool calls, attachments) arrive with the features that need them. */
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  stopReason: StopReasonSchema.optional(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationWithMessagesSchema = ConversationSchema.extend({ messages: z.array(MessageSchema) });
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
