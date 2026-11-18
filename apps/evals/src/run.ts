import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { ChatService } from '@chatbot/api/src/modules/chat/chat.service';
import { loadDotEnv } from './env';

async function main(): Promise<void> {
  loadDotEnv();

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const chat = app.get(ChatService);
  console.log(`Eval context ready (${chat.constructor.name})`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
