import { createZodDto } from 'nestjs-zod';
import { CreateConversationSchema, UpdateConversationSchema } from '@chatbot/shared';

export class CreateConversationBody extends createZodDto(CreateConversationSchema) {}
export class UpdateConversationBody extends createZodDto(UpdateConversationSchema) {}
