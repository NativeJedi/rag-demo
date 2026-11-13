import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CapabilitiesModule } from './modules/capabilities/capabilities.module';
import { ChatModule } from './modules/chat/chat.module';
import { ConfigModule } from './modules/config/config.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { HealthModule } from './modules/health/health.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LlmModule } from './modules/llm/llm.module';
import { McpModule } from './modules/mcp/mcp.module';
import { ToolsModule } from './modules/tools/tools.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    CapabilitiesModule,
    LlmModule,
    ConversationsModule,
    ChatModule,
    ToolsModule,
    AttachmentsModule,
    KnowledgeModule,
    McpModule,
    WorkflowsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
