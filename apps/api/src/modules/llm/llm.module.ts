import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider';
import { MockLlmProvider } from './mock/mock-llm.provider';

/** The seam where the real Anthropic provider plugs in (phase 2). */
@Module({
  providers: [{ provide: LLM_PROVIDER, useFactory: () => new MockLlmProvider() }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
