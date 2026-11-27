import { Module } from '@nestjs/common';
import { createDictionaryTools } from './dictionary.tools';
import { DictionaryService } from './dictionary.service';
import { getCurrentDatetime } from './get-current-datetime.tool';
import { ToolExecutor } from './tool-executor';
import { TOOLS, ToolRegistry } from './tool-registry';

@Module({
  providers: [
    DictionaryService,
    {
      provide: TOOLS,
      inject: [DictionaryService],
      useFactory: (dictionary: DictionaryService) => [getCurrentDatetime, ...createDictionaryTools(dictionary)],
    },
    ToolRegistry,
    ToolExecutor,
  ],
  exports: [ToolRegistry, ToolExecutor],
})
export class ToolsModule {}
