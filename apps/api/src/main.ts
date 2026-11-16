import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { type AppConfig, APP_CONFIG } from './modules/config/config.module';

function loadDotEnv(): void {
  // repo-root .env, regardless of the directory the process was started from
  const file = join(__dirname, '..', '..', '..', '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.WEB_ORIGIN });
  await app.listen(config.PORT);
  new Logger('Bootstrap').log(`API on http://localhost:${config.PORT}/api`);
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
