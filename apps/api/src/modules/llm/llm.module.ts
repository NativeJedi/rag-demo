import { Module } from '@nestjs/common';
import { AnthropicLlmProvider } from './anthropic/anthropic-llm.provider';
import { LLM_PROVIDER } from './llm-provider';

@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: AnthropicLlmProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
