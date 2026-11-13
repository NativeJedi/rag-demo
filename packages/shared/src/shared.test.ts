import { describe, expect, it } from 'vitest';
import {
  BlockSchema,
  CapabilitiesSchema,
  ChatEventSchema,
  ConversationSchema,
  MessageSchema,
  SendMessageSchema,
  type ChatEvent,
} from './index';

const events: ChatEvent[] = [
  { type: 'message_start', messageId: 'msg_1', model: 'm' },
  { type: 'text_delta', text: 'hi' },
  { type: 'thinking_delta', text: 'hmm' },
  { type: 'tool_call_start', toolUseId: 't1', name: 'get_time' },
  { type: 'tool_call_delta', toolUseId: 't1', partialJson: '{"a"' },
  { type: 'tool_call', toolUseId: 't1', name: 'get_time', input: { tz: 'UTC' } },
  { type: 'tool_result', toolUseId: 't1', output: { now: 'x' }, isError: false },
  { type: 'citation', citedText: 'c', source: { kind: 'doc', title: 'T', ref: 'r' }, blockIndex: 0 },
  { type: 'usage', inputTokens: 1, outputTokens: 2, cacheReadTokens: 3 },
  { type: 'message_done', stopReason: 'end_turn' },
  { type: 'error', code: 'x', message: 'boom', retryable: true },
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
  it('round-trips every block type', () => {
    const blocks = [
      { type: 'text', text: 'a', citations: [{ citedText: 'c', source: { kind: 'k', title: 't', ref: 'r' }, blockIndex: 0 }] },
      { type: 'thinking', text: 'a', signature: 's' },
      { type: 'tool_call', toolUseId: 't', name: 'n', input: { a: 1 } },
      { type: 'tool_result', toolUseId: 't', output: 'ok', isError: false },
      { type: 'attachment', attachmentId: 'att_1', kind: 'pdf' },
    ];
    for (const b of blocks) expect(BlockSchema.parse(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });

  it('round-trips conversation and message', () => {
    const conv = {
      id: 'conv_01ABC',
      title: 'T',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { model: 'default', temperature: 1, maxTokens: 4096 },
    };
    expect(ConversationSchema.parse(conv)).toEqual(conv);
    const msg = {
      id: 'msg_01ABC',
      conversationId: 'conv_01ABC',
      role: 'assistant',
      blocks: [{ type: 'text', text: 'x' }],
      stopReason: 'aborted',
      createdAt: conv.createdAt,
    };
    expect(MessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates send message bounds', () => {
    expect(SendMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(SendMessageSchema.safeParse({ content: 'x', options: { temperature: 2 } }).success).toBe(false);
    expect(SendMessageSchema.safeParse({ content: 'x', options: { model: 'fast' } }).success).toBe(true);
  });

  it('round-trips capabilities', () => {
    const caps = {
      models: [{ alias: 'default', id: 'm', label: 'M' }],
      defaults: { model: 'default', temperature: 1, maxTokens: 4096 },
      features: { streaming: true, tools: false, attachments: false, thinking: false, citations: false, knowledge: false, mcp: false, workflows: false },
      provider: 'mock',
    };
    expect(CapabilitiesSchema.parse(caps)).toEqual(caps);
  });
});
