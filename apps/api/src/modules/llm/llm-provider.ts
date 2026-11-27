import type { ChatEvent } from '@chatbot/shared';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

/** A piece of a message. Block and tool shapes follow the Messages API, so the provider passes them through. */
export type ContentBlock = { type: 'text'; text: string } | ToolUseBlock | ToolResultBlock;

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/** A tool as the model sees it: name, description and the JSON schema of its input. */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; [key: string]: unknown };
}

/** Our domain request shape. SDK mapping stays inside the provider that needs it. */
export interface LlmRequest {
  messages: LlmMessage[];
  tools?: ToolDefinition[];
}

/**
 * What a provider streams: the chat events of one model response, except that a response
 * ending in `tool_use` finishes with a `tool_use` event (the tool calls to run) instead of `message_done`.
 */
export type LlmEvent = Exclude<ChatEvent, { type: 'message_start' }> | { type: 'tool_use'; blocks: ToolUseBlock[] };

export interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<LlmEvent>;
}
