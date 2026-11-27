import { Module } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { ToolsService } from './tools.service';

@Module({
  providers: [DictionaryService, ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
