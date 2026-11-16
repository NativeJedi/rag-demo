import { describe, expect, it } from 'vitest';
import {
  ChatEventSchema,
  ConversationSchema,
  MessageSchema,
  SendMessageSchema,
  type ChatEvent,
} from './index.ts';

const events: ChatEvent[] = [
  { type: 'message_start', messageId: 'msg_1' },
  { type: 'text_delta', text: 'hi' },
  { type: 'message_done', stopReason: 'end_turn' },
  { type: 'error', code: 'provider_error', message: 'boom' },
];

describe('ChatEvent', () => {
  it.each(events)('round-trips $type', (event) => {
    expect(ChatEventSchema.parse(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  it('rejects unknown types', () => {
    expect(ChatEventSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });

  it('covers every union member', () => {
    expect(new Set(events.map((e) => e.type)).size).toBe(ChatEventSchema.options.length);
  });
});

describe('domain', () => {
  it('round-trips conversation and message', () => {
    const conv = {
      id: 'conv_01ABC',
      title: 'T',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(ConversationSchema.parse(conv)).toEqual(conv);

    const msg = {
      id: 'msg_01ABC',
      conversationId: conv.id,
      role: 'assistant',
      content: 'x',
      stopReason: 'aborted',
      createdAt: conv.createdAt,
    };
    expect(MessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates send message bounds', () => {
    expect(SendMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(SendMessageSchema.safeParse({ content: 'x' }).success).toBe(true);
  });
});
