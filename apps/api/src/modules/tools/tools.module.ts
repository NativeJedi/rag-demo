import { Controller, Get, Module } from '@nestjs/common';
import type { ToolInfo } from '@chatbot/shared';

@Controller('tools')
export class ToolsController {
  /** Empty until the registry arrives in phase 5. */
  @Get()
  list(): ToolInfo[] {
    return [];
  }
}

@Module({ controllers: [ToolsController] })
export class ToolsModule {}
