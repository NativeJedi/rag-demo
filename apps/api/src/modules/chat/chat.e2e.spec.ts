import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChatEventSchema, type ChatEvent, type ConversationWithMessages } from '@chatbot/shared';
import { createTestApp } from '../../test-app';

/** Pulls the `data:` line out of each SSE frame Nest wrote. */
function parseFrames(body: string): ChatEvent[] {
  return body
    .split('\n\n')
    .map((frame) => frame.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line) => line !== undefined)
    .map((line) => ChatEventSchema.parse(JSON.parse(line.slice('data: '.length))));
}

describe('POST /conversations/:id/messages (SSE)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  const newConversation = async (): Promise<string> => (await http().post('/api/conversations').send({})).body.id;

  const send = (id: string, content: string) =>
    http()
      .post(`/api/conversations/${id}/messages`)
      .send({ content })
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (data += c));
        res.on('end', () => cb(null, data));
      });

  it('streams SSE frames and persists user + assistant messages', async () => {
    const id = await newConversation();
    const res = await send(id, 'hello');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body as string).toContain('event: text_delta');

    const events = parseFrames(res.body as string);
    expect(events[0]?.type).toBe('message_start');
    expect(events.some((e) => e.type === 'text_delta')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });

    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.title).toBe('hello');
    expect(conv.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(conv.messages[0]?.content).toBe('hello');
    const assistant = conv.messages[1]!;
    expect(assistant.id).toBe((events[0] as { messageId: string }).messageId);
    expect(assistant.stopReason).toBe('end_turn');
    expect(assistant.content).toContain('hello');
  });

  it('keeps the title from the first message and sends history on the next turn', async () => {
    const id = await newConversation();
    await send(id, 'first question');
    await send(id, 'second question');

    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.title).toBe('first question');
    expect(conv.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    // the mock echoes the last user message, so this proves the turn saw the new question
    expect(conv.messages[3]?.content).toContain('second question');
  });

  it('ends the stream with an error event and keeps the partial text', async () => {
    const id = await newConversation();
    expect(parseFrames((await send(id, '/error')).body as string).at(-1)?.type).toBe('error');
    const conv = (await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.messages[1]?.content).not.toBe('');
    expect(conv.messages[1]?.stopReason).toBeUndefined();
  });

  it('returns 404 (JSON, not SSE) for an unknown conversation and 400 for bad input', async () => {
    const res = await http().post('/api/conversations/conv_missing/messages').send({ content: 'x' }).expect(404);
    expect(res.body.error.code).toBe('not_found');
    const id = await newConversation();
    await http().post(`/api/conversations/${id}/messages`).send({ content: '' }).expect(400);
  });

  it('stores no assistant message when Stop comes before the first word', async () => {
    const slow = await createTestApp(100);
    const slowHttp = () => request(slow.getHttpServer());
    const id = (await slowHttp().post('/api/conversations').send({})).body.id as string;
    const server = slow.getHttpServer().listen(0);
    const { port } = server.address() as { port: number };
    const ac = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'tell me something long' }),
      signal: ac.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let seen = '';
    while (!seen.includes('event: message_start')) seen += decoder.decode((await reader.read()).value);
    ac.abort();
    await reader.read().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 300)); // the first word would have come after 100 ms

    const conv = (await slowHttp().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
    expect(conv.messages.map((m) => m.role)).toEqual(['user']);
    await slow.close();
  });

  it('stops the provider on client disconnect and stores the partial reply as aborted', async () => {
    const slow = await createTestApp(5);
    const slowHttp = () => request(slow.getHttpServer());
    const id = (await slowHttp().post('/api/conversations').send({})).body.id as string;
    const server = slow.getHttpServer().listen(0);
    const { port } = server.address() as { port: number };
    const ac = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'tell me something long' }),
      signal: ac.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let seen = '';
    while (!seen.includes('event: text_delta')) seen += decoder.decode((await reader.read()).value);
    ac.abort();
    await reader.read().catch(() => undefined);

    await vi.waitFor(async () => {
      const conv = (await slowHttp().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[1]?.stopReason).toBe('aborted');
      expect(conv.messages[1]?.content).not.toBe('');
    });
    await slow.close();
  });

  describe('tool use', () => {
    const textOf = (events: ChatEvent[]) =>
      events.map((e) => (e.type === 'text_delta' ? e.text : '')).join('');
    const history = async (id: string) =>
      ((await http().get(`/api/conversations/${id}`)).body as ConversationWithMessages).messages;

    it('runs a multi-step tool turn and answers in one merged message', async () => {
      const id = await newConversation();
      const events = parseFrames((await send(id, '/tools add lucid')).body as string);

      expect(events.filter((e) => e.type === 'message_start')).toHaveLength(1);
      expect(events.at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });
      const reply = textOf(events);
      expect(reply).toContain('Checking.');
      expect(reply).toContain('{"added":["lucid"],"skipped":[]}'); // add_words ran with the date from get_current_datetime

      const messages = await history(id);
      expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
      expect(messages[1]?.content).toBe(reply); // GET equals what was streamed
      expect(messages[1]?.id).toBe((events[0] as { messageId: string }).messageId);
      expect(messages[1]?.stopReason).toBe('end_turn');
    });

    it('reports a word added earlier as skipped', async () => {
      const id = await newConversation();
      await send(id, '/tools first');
      const events = parseFrames((await send(id, '/tools again')).body as string);
      expect(textOf(events)).toContain('already exists');
    });

    it('returns a tool error to the model as an error result', async () => {
      const id = await newConversation();
      const reply = textOf(parseFrames((await send(id, '/badtool')).body as string));
      expect(reply).toContain('Invalid input');
    });

    it('stops a runaway loop with an error and keeps the conversation usable', async () => {
      const id = await newConversation();
      const events = parseFrames((await send(id, '/loop')).body as string);
      expect(events.at(-1)).toMatchObject({ type: 'error', code: 'tool_loop_limit' });

      const next = parseFrames((await send(id, 'still there?')).body as string);
      expect(textOf(next)).toContain('still there?');
      expect(next.at(-1)?.type).toBe('message_done');
    });

    it('leaves a history the next message can continue from after Stop mid-loop', async () => {
      const slow = await createTestApp(5);
      const slowHttp = () => request(slow.getHttpServer());
      const id = (await slowHttp().post('/api/conversations').send({})).body.id as string;
      const server = slow.getHttpServer().listen(0);
      const { port } = server.address() as { port: number };
      const url = `http://127.0.0.1:${port}/api/conversations/${id}/messages`;
      const post = (content: string, signal?: AbortSignal) =>
        fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }), signal });

      const ac = new AbortController();
      const res = await post('/tools add lucid', ac.signal);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let seen = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) throw new Error('stream ended before the final answer began');
        seen += decoder.decode(value);
        if (seen.includes('Tools ')) break; // tools ran, the final answer began
      }
      ac.abort();
      await reader.read().catch(() => undefined);

      await vi.waitFor(async () => {
        const messages = (await slowHttp().get(`/api/conversations/${id}`)).body as ConversationWithMessages;
        expect(messages.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
        expect(messages.messages[1]?.stopReason).toBe('aborted');
      });

      const next = await (await post('hello again')).text(); // the fake rejects history with unanswered tool calls
      expect(parseFrames(next).at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });
      await slow.close();
    });
  });
});
