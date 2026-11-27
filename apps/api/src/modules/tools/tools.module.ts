import { Module } from '@nestjs/common';
import { getCurrentDatetime } from './get-current-datetime.tool';
import { ToolExecutor } from './tool-executor';
import { TOOLS, ToolRegistry } from './tool-registry';

@Module({
  providers: [{ provide: TOOLS, useValue: [getCurrentDatetime] }, ToolRegistry, ToolExecutor],
  exports: [ToolRegistry, ToolExecutor],
})
export class ToolsModule {}
