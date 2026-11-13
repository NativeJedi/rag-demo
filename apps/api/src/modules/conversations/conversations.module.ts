import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { ConversationRepository, MessageRepository } from './conversation.repository';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { InMemoryConversationRepository, InMemoryMessageRepository } from './in-memory.repositories';

@Module({
  imports: [CapabilitiesModule],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    { provide: ConversationRepository, useClass: InMemoryConversationRepository },
    { provide: MessageRepository, useClass: InMemoryMessageRepository },
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
