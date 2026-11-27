import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { ChatModule } from './modules/chat/chat.module';
import { ConfigModule } from './modules/config/config.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { LlmModule } from './modules/llm/llm.module';
import { ToolsModule } from './modules/tools/tools.module';

@Module({
  imports: [ConfigModule, LlmModule, ConversationsModule, ToolsModule, ChatModule],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
