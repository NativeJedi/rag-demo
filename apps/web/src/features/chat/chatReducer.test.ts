import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';

const feed = (events: ChatEvent[], from: ChatState = initialChatState) =>
  events.reduce((state, event) => chatReducer(state, { type: 'event', event }), from);

const sending = chatReducer(initialChatState, { type: 'send', text: 'hi' });

describe('chatReducer', () => {
  it('starts streaming with the optimistic user text', () => {
    expect(sending).toEqual({ status: 'streaming', pendingUser: 'hi', message: { text: '' } });
  });

  it('joins text deltas and records the id and stop reason', () => {
    const state = feed(
      [
        { type: 'message_start', messageId: 'msg_1' },
        { type: 'text_delta', text: 'Hel' },
        { type: 'text_delta', text: 'lo' },
        { type: 'message_done', stopReason: 'end_turn' },
      ],
      sending,
    );
    expect(state).toMatchObject({ status: 'idle', message: { id: 'msg_1', text: 'Hello', stopReason: 'end_turn' } });
  });

  it('keeps the partial text next to the error', () => {
    const state = feed(
      [
        { type: 'text_delta', text: 'partial' },
        { type: 'error', code: 'provider_error', message: 'boom' },
      ],
      sending,
    );
    expect(state).toMatchObject({ status: 'idle', message: { text: 'partial' }, error: { code: 'provider_error' } });
  });

  it('marks the reply aborted on Stop and keeps the error across reset', () => {
    const stopped = chatReducer(feed([{ type: 'text_delta', text: 'a' }], sending), { type: 'abort' });
    expect(stopped).toMatchObject({ status: 'idle', message: { text: 'a', stopReason: 'aborted' } });

    const failed = chatReducer(stopped, { type: 'fail', error: { code: 'request_failed', message: 'no network' } });
    expect(chatReducer(failed, { type: 'reset' })).toEqual({ status: 'idle', error: failed.error });
  });

  it('leaves no stuck Stop button when the stream is truncated', () => {
    expect(chatReducer(sending, { type: 'finish' }).status).toBe('idle');
  });
});
