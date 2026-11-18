import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
// Runtime: the built API (`pnpm eval` builds it first). Types: the API source (tsconfig.json paths; tsconfig.run.json has none so tsx loads the built code).
import { AppModule } from '@chatbot/api/dist/app.module';
import { ChatService } from '@chatbot/api/dist/modules/chat/chat.service';

async function main(): Promise<void> {
  const envFile = join(__dirname, '..', '..', '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const chat = app.get(ChatService);
  console.log(`Eval context ready (${chat.constructor.name})`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
