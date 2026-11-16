import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = 3000;
const WEB_ORIGIN = 'http://localhost:5173';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: WEB_ORIGIN });
  await app.listen(PORT);
  new Logger('Bootstrap').log(`API on http://localhost:${PORT}/api (llm: mock)`);
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
