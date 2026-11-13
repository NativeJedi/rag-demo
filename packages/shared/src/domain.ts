import { z } from 'zod';
import { ConversationIdSchema, MessageIdSchema } from './ids';

export const StopReasonSchema = z.enum(['end_turn', 'max_tokens', 'tool_use', 'stop_sequence', 'aborted']);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const ModelAliasSchema = z.enum(['default', 'fast']);
export type ModelAlias = z.infer<typeof ModelAliasSchema>;

export const UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const CitationSourceSchema = z.object({
  kind: z.string(),
  title: z.string(),
  ref: z.string(),
});
export type CitationSource = z.infer<typeof CitationSourceSchema>;

export const CitationSchema = z.object({
  citedText: z.string(),
  source: CitationSourceSchema,
  blockIndex: z.number().int().nonnegative(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string(), citations: z.array(CitationSchema).optional() }),
  z.object({ type: z.literal('thinking'), text: z.string(), signature: z.string().optional() }),
  z.object({ type: z.literal('tool_call'), toolUseId: z.string(), name: z.string(), input: z.unknown() }),
  z.object({ type: z.literal('tool_result'), toolUseId: z.string(), output: z.unknown(), isError: z.boolean() }),
  z.object({ type: z.literal('attachment'), attachmentId: z.string(), kind: z.enum(['image', 'pdf']) }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const ThinkingSettingsSchema = z.object({
  enabled: z.boolean(),
  budgetTokens: z.number().int().positive(),
});

export const ConversationSettingsSchema = z.object({
  model: ModelAliasSchema,
  system: z.string().optional(),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(1).max(64000),
  thinking: ThinkingSettingsSchema.optional(),
});
export type ConversationSettings = z.infer<typeof ConversationSettingsSchema>;

export const ConversationSchema = z.object({
  id: ConversationIdSchema,
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: ConversationSettingsSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationSummarySchema = ConversationSchema.pick({ id: true, title: true, updatedAt: true });
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const MessageSchema = z.object({
  id: MessageIdSchema,
  conversationId: ConversationIdSchema,
  role: z.enum(['user', 'assistant']),
  blocks: z.array(BlockSchema),
  model: z.string().optional(),
  usage: UsageSchema.optional(),
  stopReason: StopReasonSchema.optional(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationWithMessagesSchema = ConversationSchema.extend({ messages: z.array(MessageSchema) });
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;
