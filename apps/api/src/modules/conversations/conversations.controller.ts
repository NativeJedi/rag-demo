import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { CreateConversationSchema, type Conversation, type ConversationSummary, type ConversationWithMessages } from '@chatbot/shared';
import { ConversationsService } from './conversations.service';

class CreateConversationBody extends createZodDto(CreateConversationSchema) {}

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  list(): ConversationSummary[] {
    return this.service.list();
  }

  @Post()
  create(@Body() body: CreateConversationBody): Conversation {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): ConversationWithMessages {
    return this.service.getWithMessages(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.service.remove(id);
  }
}
