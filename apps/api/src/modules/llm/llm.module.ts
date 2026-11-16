import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { AnthropicLlmProvider } from './anthropic/anthropic-llm.provider';
import { LLM_PROVIDER } from './llm-provider';

const MODEL = 'claude-haiku-5-5';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new AnthropicLlmProvider(new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }), MODEL),
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
