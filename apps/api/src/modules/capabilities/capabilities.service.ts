import { Inject, Injectable } from '@nestjs/common';
import type { Capabilities } from '@chatbot/shared';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

@Injectable()
export class CapabilitiesService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get(): Capabilities {
    return {
      models: [
        { alias: 'default', id: this.config.MODEL_DEFAULT, label: 'Default' },
        { alias: 'fast', id: this.config.MODEL_FAST, label: 'Fast' },
      ],
      defaults: { model: 'default', temperature: 1, maxTokens: 4096 },
      // each phase flips its own flag; phase 1 only streams
      features: {
        streaming: true,
        tools: false,
        attachments: false,
        thinking: false,
        citations: false,
        knowledge: false,
        mcp: false,
        workflows: false,
      },
      provider: this.config.LLM_PROVIDER,
    };
  }
}
