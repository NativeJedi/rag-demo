import { z } from 'zod';

export const CreateConversationSchema = z.object({ title: z.string().min(1).max(200).optional() });
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({ content: z.string().min(1).max(32_000) });
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const ApiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ApiErrorSchema>;
