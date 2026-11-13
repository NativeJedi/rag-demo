import type { ChatEvent, StopReason, Usage } from '@chatbot/shared';
import type { Part } from './parts';

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface LiveMessage {
  id?: string;
  model?: string;
  parts: Part[];
  usage?: Usage;
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

function update(state: ChatState, fn: (m: LiveMessage) => LiveMessage): ChatState {
  return { ...state, message: fn(state.message ?? { parts: [] }) };
}

function appendText(parts: Part[], kind: 'text' | 'thinking', text: string): Part[] {
  const last = parts.at(-1);
  if (last?.kind === kind) return [...parts.slice(0, -1), { ...last, text: last.text + text }];
  return [...parts, kind === 'text' ? { kind, text, citations: [] } : { kind, text }];
}

function updateTool(parts: Part[], toolUseId: string, fn: (p: Extract<Part, { kind: 'tool' }>) => Extract<Part, { kind: 'tool' }>): Part[] {
  return parts.map((p) => (p.kind === 'tool' && p.toolUseId === toolUseId ? fn(p) : p));
}

/** The only place ChatEvents are interpreted. Every union member is handled (checked by `never`). */
export function applyEvent(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'message_start':
      return update(state, (m) => ({ ...m, id: event.messageId, model: event.model }));
    case 'text_delta':
      return update(state, (m) => ({ ...m, parts: appendText(m.parts, 'text', event.text) }));
    case 'thinking_delta':
      return update(state, (m) => ({ ...m, parts: appendText(m.parts, 'thinking', event.text) }));
    case 'tool_call_start':
      return update(state, (m) => ({
        ...m,
        parts: [...m.parts, { kind: 'tool', toolUseId: event.toolUseId, name: event.name, inputJson: '' }],
      }));
    case 'tool_call_delta':
      return update(state, (m) => ({
        ...m,
        parts: updateTool(m.parts, event.toolUseId, (p) => ({ ...p, inputJson: p.inputJson + event.partialJson })),
      }));
    case 'tool_call':
      return update(state, (m) => {
        const exists = m.parts.some((p) => p.kind === 'tool' && p.toolUseId === event.toolUseId);
        const parts = exists
          ? updateTool(m.parts, event.toolUseId, (p) => ({ ...p, name: event.name, input: event.input, inputJson: JSON.stringify(event.input) }))
          : [...m.parts, { kind: 'tool' as const, toolUseId: event.toolUseId, name: event.name, inputJson: JSON.stringify(event.input), input: event.input }];
        return { ...m, parts };
      });
    case 'tool_result':
      return update(state, (m) => ({
        ...m,
        parts: updateTool(m.parts, event.toolUseId, (p) => ({ ...p, result: { output: event.output, isError: event.isError } })),
      }));
    case 'citation':
      return update(state, (m) => {
        const index = m.parts.findLastIndex((p) => p.kind === 'text');
        const part = m.parts[index];
        if (!part || part.kind !== 'text') return m;
        const { citedText, source, blockIndex } = event;
        const parts = m.parts.slice();
        parts[index] = { ...part, citations: [...part.citations, { citedText, source, blockIndex }] };
        return { ...m, parts };
      });
    case 'usage': {
      const { type: _type, ...usage } = event;
      return update(state, (m) => ({ ...m, usage }));
    }
    case 'message_done':
      return { ...update(state, (m) => ({ ...m, stopReason: event.stopReason })), status: 'idle' };
    case 'error':
      return { ...state, status: 'idle', error: { code: event.code, message: event.message, retryable: event.retryable } };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send':
      return { status: 'streaming', pendingUser: action.text, message: { parts: [] } };
    case 'event':
      return applyEvent(state, action.event);
    case 'abort':
      return {
        ...state,
        status: 'idle',
        message: state.message && { ...state.message, stopReason: 'aborted' },
      };
    case 'fail':
      return { ...state, status: 'idle', error: action.error };
    case 'finish':
      return state.status === 'streaming' ? { ...state, status: 'idle' } : state;
    case 'reset':
      return { ...initialChatState, error: state.error };
  }
}
