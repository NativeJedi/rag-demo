import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { Conversation, ConversationSummary, ConversationWithMessages } from '@chatbot/shared';
import { ConversationsService } from './conversations.service';
import { CreateConversationBody, UpdateConversationBody } from './dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  list(): Promise<ConversationSummary[]> {
    return this.service.list();
  }

  @Post()
  create(@Body() body: CreateConversationBody): Promise<Conversation> {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ConversationWithMessages> {
    return this.service.getWithMessages(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateConversationBody): Promise<Conversation> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}
