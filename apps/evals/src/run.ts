import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { ChatService } from '@chatbot/api/src/modules/chat/chat.service';
import { ConversationsService } from '@chatbot/api/src/modules/conversations/conversations.service';
import { DatasetSchema } from './dataset';
import { loadDotEnv } from './env';
import { runCases } from './runner';

async function main(): Promise<void> {
  loadDotEnv();
  const cases = DatasetSchema.parse(JSON.parse(readFileSync(join(__dirname, '..', 'dataset.json'), 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const chat = app.get(ChatService);
  const conversations = app.get(ConversationsService);

  // every case is a fresh conversation, answered by the real ChatService
  const reply = async (input: string): Promise<string> => {
    const { id } = conversations.create({});
    let text = '';
    for await (const event of chat.streamReply(id, { content: input }, new AbortController().signal)) {
      if (event.type === 'text_delta') text += event.text;
      if (event.type === 'error') throw new Error(event.message);
    }
    return text;
  };

  const results = await runCases(cases, reply);
  for (const r of results) {
    console.log(`${r.case.id}: ${r.error ? `ERROR ${r.error}` : `${r.reply.split(/\s+/).length} words`}`);
  }
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
