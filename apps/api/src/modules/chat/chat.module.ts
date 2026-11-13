import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { LlmModule } from '../llm/llm.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [ConversationsModule, CapabilitiesModule, LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
