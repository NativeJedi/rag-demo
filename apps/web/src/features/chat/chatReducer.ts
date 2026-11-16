import type { ChatEvent, StopReason } from '@chatbot/shared';

export interface StreamError {
  code: string;
  message: string;
}

/** The assistant reply being streamed right now, before the server copy is refetched. */
export interface LiveMessage {
  id?: string;
  text: string;
  stopReason?: StopReason;
}

export interface ChatState {
  status: 'idle' | 'streaming';
  /** Optimistic user text shown until the server copy is refetched. */
  pendingUser?: string;
  message?: LiveMessage;
  error?: StreamError;
}

export type ChatAction =
  | { type: 'send'; text: string }
  | { type: 'event'; event: ChatEvent }
  | { type: 'abort' }
  | { type: 'fail'; error: StreamError }
  | { type: 'finish' }
  | { type: 'reset' };

export const initialChatState: ChatState = { status: 'idle' };

/** The only place ChatEvents are interpreted. Every union member is handled (checked by `never`). */
function applyEvent(state: ChatState, event: ChatEvent): ChatState {
  const message = state.message ?? { text: '' };
  switch (event.type) {
    case 'message_start':
      return { ...state, message: { ...message, id: event.messageId } };
    case 'text_delta':
      return { ...state, message: { ...message, text: message.text + event.text } };
    case 'message_done':
      return { ...state, status: 'idle', message: { ...message, stopReason: event.stopReason } };
    case 'error':
      return { ...state, status: 'idle', error: { code: event.code, message: event.message } };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send':
      return { status: 'streaming', pendingUser: action.text, message: { text: '' } };
    case 'event':
      return applyEvent(state, action.event);
    case 'abort':
      return { ...state, status: 'idle', message: state.message && { ...state.message, stopReason: 'aborted' } };
    case 'fail':
      return { ...state, status: 'idle', error: action.error };
    case 'finish':
      // the stream ended without message_done (truncated connection)
      return { ...state, status: 'idle' };
    case 'reset':
      return { ...initialChatState, error: state.error };
  }
}
