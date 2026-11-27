import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChatEvent, SendMessageDto, StopReason } from '@chatbot/shared';
import { newId } from '../../common/ids';
import { ConversationsService, DEFAULT_TITLE, type StoredMessage } from '../conversations/conversations.service';
import {
  LLM_PROVIDER,
  type ContentBlock,
  type LlmMessage,
  type LlmProvider,
  type LlmRequest,
  type ToolUseBlock,
} from '../llm/llm-provider';
import { ToolsService } from '../tools/tools.service';

/** Model calls per user message (each tool round is one more call). */
const MAX_ITERATIONS = 8;

type ErrorEvent = Extract<ChatEvent, { type: 'error' }>;

const TOOL_LOOP_LIMIT_ERROR: ErrorEvent = {
  type: 'error',
  code: 'tool_loop_limit',
  message: `Stopped after ${MAX_ITERATIONS} model calls`,
};

/**
 * The assistant message being streamed. A tool round stores what was said so far and starts the next message;
 * the client still sees one message under `messageId`.
 */
class ReplyDraft {
  /** The id the client got in message_start; only the first stored message carries it. */
  assistantId: string | undefined;
  text = '';
  stopReason: StopReason | undefined;
  failed = false;

  constructor(readonly messageId: string) {
    this.assistantId = messageId;
  }

  append(text: string): void {
    this.text += text;
  }

  finish(stopReason: StopReason): void {
    this.stopReason = stopReason;
  }

  fail(event: ErrorEvent): ErrorEvent {
    this.failed = true;
    return event;
  }

  startNextMessage(): void {
    this.assistantId = undefined;
    this.text = '';
  }

  /**
   * Neither message_done nor error means the stream was cut short: the Stop button.
   * (`signal` cannot tell us — Nest also aborts it when the response completes normally.)
   */
  finalStopReason(): StopReason | undefined {
    return this.stopReason ?? (this.failed ? undefined : 'aborted');
  }

  contentBlocks(): ContentBlock[] {
    return this.text ? [{ type: 'text', text: this.text }] : [];
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly tools: ToolsService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  /**
   * One assistant turn: record the question, then loop — stream the model, run the tools it asks for
   * (all calls of one response in parallel), send the results back — until it answers in text.
   * The client sees one stream: one message_start, text deltas, one final message_done.
   */
  async *streamReply(conversationId: string, dto: SendMessageDto, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    // throws before the first event, and Nest holds the SSE headers until then,
    // so an unknown conversation still comes back as a JSON 404
    const messages = this.recordQuestion(conversationId, dto.content);
    const reply = new ReplyDraft(newId('msg'));

    yield { type: 'message_start', messageId: reply.messageId };
    try {
      yield* this.runToolLoop(conversationId, messages, reply, signal);
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      const message = err instanceof Error ? err.message : 'Unknown error';
      yield reply.fail({ type: 'error', code: 'provider_error', message });
    } finally {
      this.saveUnfinishedText(conversationId, reply);
    }
  }

  /** Stores the question and returns the history for the model, ending with it. */
  private recordQuestion(conversationId: string, content: string): LlmMessage[] {
    const conversation = this.conversations.getOrThrow(conversationId);
    this.conversations.appendMessage(conversationId, { role: 'user', content: [{ type: 'text', text: content }] });

    const history = this.conversations.listMessages(conversationId);
    if (history.length === 1 && conversation.title === DEFAULT_TITLE) {
      // placeholder until LLM-generated titles arrive in phase 2
      this.conversations.setTitle(conversationId, truncateTitle(content));
    }
    return toLlmMessages(history);
  }

  private async *runToolLoop(
    conversationId: string,
    messages: LlmMessage[],
    reply: ReplyDraft,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const tools = this.tools.definitions();
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const toolUses = yield* this.streamModelResponse({ messages, tools }, reply, signal);
      if (toolUses.length === 0 || reply.failed || signal.aborted) return;
      await this.answerToolCalls(conversationId, messages, reply, toolUses);
    }
    yield reply.fail(TOOL_LOOP_LIMIT_ERROR);
  }

  /** Forwards one model response to the client; returns the tool calls it asked for, if any. */
  private async *streamModelResponse(
    request: LlmRequest,
    reply: ReplyDraft,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent, ToolUseBlock[]> {
    let toolUses: ToolUseBlock[] = [];
    for await (const event of this.llm.stream(request, signal)) {
      switch (event.type) {
        case 'text_delta':
          reply.append(event.text);
          yield event;
          break;
        case 'tool_use':
          toolUses = event.blocks;
          break;
        case 'message_done':
          reply.finish(event.stopReason);
          yield event;
          break;
        case 'error':
          yield reply.fail(event);
          break;
      }
    }
    return toolUses;
  }

  /** Runs the tool calls and stores them with their results, so the next model call can see both. */
  private async answerToolCalls(
    conversationId: string,
    messages: LlmMessage[],
    reply: ReplyDraft,
    toolUses: ToolUseBlock[],
  ): Promise<void> {
    // the tool_use message is stored only together with its results: the API rejects unanswered tool calls
    const results = await this.tools.runAll(toolUses);
    const assistant: LlmMessage = { role: 'assistant', content: [...reply.contentBlocks(), ...toolUses] };
    const answers: LlmMessage = { role: 'user', content: results };

    this.conversations.appendMessage(conversationId, { id: reply.assistantId, ...assistant });
    this.conversations.appendMessage(conversationId, answers);
    messages.push(assistant, answers);
    reply.startNextMessage();
  }

  /** Keeps what the model managed to say, even after a Stop or an error; no words means no message. */
  private saveUnfinishedText(conversationId: string, reply: ReplyDraft): void {
    if (!reply.text) return;
    const stopReason = reply.finalStopReason();
    this.conversations.appendMessage(conversationId, {
      id: reply.assistantId,
      role: 'assistant',
      content: reply.contentBlocks(),
      ...(stopReason && { stopReason }),
    });
  }
}

/** History for the model: only role and content, the API rejects extra fields. */
function toLlmMessages(stored: StoredMessage[]): LlmMessage[] {
  return stored.map(({ role, content }) => ({ role, content }));
}

function truncateTitle(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}
