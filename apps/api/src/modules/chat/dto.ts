import { createZodDto } from 'nestjs-zod';
import { SendMessageSchema } from '@chatbot/shared';

export class SendMessageBody extends createZodDto(SendMessageSchema) {}
