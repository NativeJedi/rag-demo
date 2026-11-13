import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { AnthropicLlmProvider } from './anthropic/anthropic-llm.provider';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider';
import { MockLlmProvider } from './mock/mock-llm.provider';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): LlmProvider =>
        config.LLM_PROVIDER === 'anthropic' ? new AnthropicLlmProvider() : new MockLlmProvider(),
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
