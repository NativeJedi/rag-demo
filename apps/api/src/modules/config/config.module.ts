import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './config.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type { AppConfig };

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
