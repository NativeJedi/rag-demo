import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChatEventSchema, type ChatEvent, type ConversationWithMessages } from '@chatbot/shared';
import { createTestApp } from '../../test-app';
import { formatFrame, startHeartbeat } from './sse';

function parseFrames(body: string): ChatEvent[] {
  return body
    .split('\n\n')
    .filter((f) => f.startsWith('event:'))
    .map((f) => {
      const [, data] = f.split('\n');
      return ChatEventSchema.parse(JSON.parse(data!.slice('data: '.length)));
    });
}

describe('POST /conversations/:id/messages (SSE)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  async function newConversation(): Promise<string> {
    return (await http().post('/api/conversations').send({})).body.id;
  }

  async function send(id: string, content: string) {
    return http().post(`/api/conversations/${id}/messages`).send({ content }).buffer(true).parse((res, cb) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (data += c));
      res.on('end', () => cb(null, data));
    });
  }

  it('streams SSE frames and persists user + assistant messages', async () => {
    const id = await newConversation();
    const res = await send(id, 'hello');
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseFrames(res.body as string);
    expect(events[0]?.type).toBe('message_start');
    expect(events.at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });

    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.title).toBe('hello');
    expect(conv.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const assistant = conv.messages[1]!;
    expect(assistant.id).toBe((events[0] as { messageId: string }).messageId);
    expect(assistant.stopReason).toBe('end_turn');
    expect(assistant.usage?.outputTokens).toBeGreaterThan(0);
    expect(assistant.blocks[0]).toMatchObject({ type: 'text' });
  });

  it('persists every block type for /mock tools, /mock thinking and /mock citations', async () => {
    const id = await newConversation();
    await send(id, '/mock tools');
    await send(id, '/mock thinking');
    await send(id, '/mock citations');
    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    const blocks = conv.messages.filter((m) => m.role === 'assistant').flatMap((m) => m.blocks);
    expect(new Set(blocks.map((b) => b.type))).toEqual(new Set(['text', 'thinking', 'tool_call', 'tool_result']));
    const cited = blocks.find((b) => b.type === 'text' && b.citations);
    expect(cited && cited.type === 'text' ? cited.citations : []).toHaveLength(2);
  });

  it('ends the stream with an error event for /mock error and keeps the partial text', async () => {
    const id = await newConversation();
    const events = parseFrames(((await send(id, '/mock error')).body as string));
    expect(events.at(-1)?.type).toBe('error');
    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.messages[1]?.blocks[0]).toMatchObject({ type: 'text' });
  });

  it('returns 404 (JSON, not SSE) for an unknown conversation and 400 for bad input', async () => {
    const res = await http().post('/api/conversations/conv_missing/messages').send({ content: 'x' }).expect(404);
    expect(res.body.error.code).toBe('not_found');
    const id = await newConversation();
    await http().post(`/api/conversations/${id}/messages`).send({ content: '' }).expect(400);
  });

  it('aborts the provider on client disconnect and stores the partial reply as aborted', async () => {
    const slow = await createTestApp(5);
    const slowHttp = () => request(slow.getHttpServer());
    const id = (await slowHttp().post('/api/conversations').send({})).body.id as string;
    const server = slow.getHttpServer().listen(0);
    const { port } = server.address() as { port: number };
    const ac = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '/mock long' }),
      signal: ac.signal,
    });
    const reader = res.body!.getReader();
    let seen = '';
    const decoder = new TextDecoder();
    while (!seen.includes('event: text_delta')) seen += decoder.decode((await reader.read()).value);
    ac.abort();
    await reader.read().catch(() => undefined);

    await vi.waitFor(async () => {
      const conv = (await slowHttp().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[1]?.stopReason).toBe('aborted');
      expect(conv.messages[1]?.blocks[0]).toMatchObject({ type: 'text' });
    });
    await slow.close();
  });
});

describe('sse helpers', () => {
  it('formats a frame per SPEC §6', () => {
    expect(formatFrame({ type: 'text_delta', text: 'a' })).toBe('event: text_delta\ndata: {"type":"text_delta","text":"a"}\n\n');
  });

  it('sends a ping comment every 15 s until stopped', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const stop = startHeartbeat({ write });
    vi.advanceTimersByTime(14_999);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(15_000);
    expect(write.mock.calls).toEqual([[': ping\n\n'], [': ping\n\n']]);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(write).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
