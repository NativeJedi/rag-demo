import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../test-app';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatService } from './chat.service';

describe('ChatService.reply', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('returns the full answer and saves both messages', async () => {
    const conversations = app.get(ConversationsService);
    const { id } = conversations.create({});
    const text = await app.get(ChatService).reply(id, { content: 'hello' });
    expect(text).toBe('You said: hello');
    expect(conversations.listMessages(id).map((m) => [m.role, m.content])).toEqual([
      ['user', 'hello'],
      ['assistant', 'You said: hello'],
    ]);
  });
});
