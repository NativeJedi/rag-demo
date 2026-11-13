import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';

const run = (events: ChatEvent[], from: ChatState = chatReducer(initialChatState, { type: 'send', text: 'hi' })) =>
  events.reduce((s, event) => chatReducer(s, { type: 'event', event }), from);

describe('chatReducer', () => {
  it('send starts streaming with an optimistic user message', () => {
    const s = chatReducer(initialChatState, { type: 'send', text: 'hello' });
    expect(s).toMatchObject({ status: 'streaming', pendingUser: 'hello', message: { parts: [] } });
  });

  it('message_start records id and model', () => {
    expect(run([{ type: 'message_start', messageId: 'msg_1', model: 'm' }]).message).toMatchObject({ id: 'msg_1', model: 'm' });
  });

  it('text_delta appends and merges into one text part', () => {
    const s = run([
      { type: 'text_delta', text: 'Hel' },
      { type: 'text_delta', text: 'lo' },
    ]);
    expect(s.message?.parts).toEqual([{ kind: 'text', text: 'Hello', citations: [] }]);
  });

  it('thinking_delta builds a thinking part before the text part', () => {
    const s = run([
      { type: 'thinking_delta', text: 'a' },
      { type: 'thinking_delta', text: 'b' },
      { type: 'text_delta', text: 'x' },
    ]);
    expect(s.message?.parts.map((p) => p.kind)).toEqual(['thinking', 'text']);
    expect(s.message?.parts[0]).toMatchObject({ text: 'ab' });
  });

  it('tool events: start → delta → call → result', () => {
    const s = run([
      { type: 'tool_call_start', toolUseId: 't1', name: 'get_weather' },
      { type: 'tool_call_delta', toolUseId: 't1', partialJson: '{"city":' },
      { type: 'tool_call_delta', toolUseId: 't1', partialJson: '"Berlin"}' },
    ]);
    expect(s.message?.parts[0]).toMatchObject({ kind: 'tool', name: 'get_weather', inputJson: '{"city":"Berlin"}' });
    const done = run(
      [
        { type: 'tool_call', toolUseId: 't1', name: 'get_weather', input: { city: 'Berlin' } },
        { type: 'tool_result', toolUseId: 't1', output: { t: 14 }, isError: false },
      ],
      s,
    );
    expect(done.message?.parts).toHaveLength(1);
    expect(done.message?.parts[0]).toMatchObject({ input: { city: 'Berlin' }, result: { output: { t: 14 }, isError: false } });
  });

  it('tool_call without a start creates the card; error results are flagged', () => {
    const s = run([
      { type: 'tool_call', toolUseId: 't2', name: 'x', input: {} },
      { type: 'tool_result', toolUseId: 't2', output: 'boom', isError: true },
    ]);
    expect(s.message?.parts[0]).toMatchObject({ kind: 'tool', result: { isError: true } });
  });

  it('citation attaches to the latest text part', () => {
    const s = run([
      { type: 'text_delta', text: 'claim' },
      { type: 'citation', citedText: 'src', source: { kind: 'web', title: 'T', ref: 'r' }, blockIndex: 0 },
    ]);
    expect(s.message?.parts[0]).toMatchObject({ kind: 'text', citations: [{ citedText: 'src', source: { title: 'T' } }] });
  });

  it('citation with no text part is ignored', () => {
    const s = run([{ type: 'citation', citedText: 'src', source: { kind: 'web', title: 'T', ref: 'r' }, blockIndex: 0 }]);
    expect(s.message?.parts).toEqual([]);
  });

  it('usage is stored (with cache tokens)', () => {
    expect(run([{ type: 'usage', inputTokens: 1, outputTokens: 2, cacheReadTokens: 3 }]).message?.usage).toEqual({
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
    });
  });

  it('message_done stores stop reason and stops streaming', () => {
    const s = run([{ type: 'message_done', stopReason: 'max_tokens' }]);
    expect(s).toMatchObject({ status: 'idle', message: { stopReason: 'max_tokens' } });
  });

  it('error keeps partial output and records the error', () => {
    const s = run([
      { type: 'text_delta', text: 'partial' },
      { type: 'error', code: 'overloaded', message: 'try later', retryable: true },
    ]);
    expect(s.status).toBe('idle');
    expect(s.error).toEqual({ code: 'overloaded', message: 'try later', retryable: true });
    expect(s.message?.parts[0]).toMatchObject({ text: 'partial' });
  });

  it('abort keeps the partial reply and marks it aborted', () => {
    const s = chatReducer(run([{ type: 'text_delta', text: 'half' }]), { type: 'abort' });
    expect(s).toMatchObject({ status: 'idle', message: { stopReason: 'aborted' } });
    expect(s.message?.parts[0]).toMatchObject({ text: 'half' });
  });

  it('fail records a network error; reset clears the stream but keeps the error', () => {
    const failed = chatReducer(chatReducer(initialChatState, { type: 'send', text: 'x' }), {
      type: 'fail',
      error: { code: 'network', message: 'offline', retryable: true },
    });
    const reset = chatReducer(failed, { type: 'reset' });
    expect(reset).toEqual({ status: 'idle', error: failed.error });
  });

  it('send clears a previous error', () => {
    const s = chatReducer({ status: 'idle', error: { code: 'x', message: 'm', retryable: false } }, { type: 'send', text: 'again' });
    expect(s.error).toBeUndefined();
  });
});
