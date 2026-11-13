import { z } from 'zod';
import { ConversationSettingsSchema, ModelAliasSchema, ThinkingSettingsSchema } from './domain';

export const CreateConversationSchema = z.object({ title: z.string().min(1).max(200).optional() });
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const UpdateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  settings: ConversationSettingsSchema.partial().optional(),
});
export type UpdateConversationDto = z.infer<typeof UpdateConversationSchema>;

export const SendMessageOptionsSchema = z.object({
  model: ModelAliasSchema.optional(),
  system: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(1).max(64000).optional(),
  thinking: ThinkingSettingsSchema.optional(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(32_000),
  attachments: z.array(z.string()).optional(),
  options: SendMessageOptionsSchema.optional(),
});
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const ApiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ToolInfoSchema = z.object({ name: z.string(), description: z.string(), enabled: z.boolean() });
export type ToolInfo = z.infer<typeof ToolInfoSchema>;
