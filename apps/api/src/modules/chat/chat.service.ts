import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChatEvent, SendMessageDto, StopReason } from '@chatbot/shared';
import { newId } from '../../common/ids';
import { ConversationsService, DEFAULT_TITLE } from '../conversations/conversations.service';
import { LLM_PROVIDER, type LlmMessage, type LlmProvider } from '../llm/llm-provider';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversations: ConversationsService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  /** One assistant turn, not streamed: answer in full and save it. Used by the evals. */
  async reply(conversationId: string, dto: SendMessageDto): Promise<string> {
    const messages = this.recordQuestion(conversationId, dto);
    const text = await this.llm.complete({ messages });
    this.saveAnswer(conversationId, newId('msg'), text, 'end_turn');
    return text;
  }

  /** One assistant turn: record the question, stream the answer, save what arrived. */
  async *streamReply(conversationId: string, dto: SendMessageDto, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const messages = this.recordQuestion(conversationId, dto);
    const messageId = newId('msg');

    let text = '';
    let stopReason: StopReason | undefined;
    let failed = false;

    yield { type: 'message_start', messageId };
    try {
      for await (const event of this.llm.stream({ messages }, signal)) {
        if (event.type === 'text_delta') text += event.text;
        if (event.type === 'message_done') stopReason = event.stopReason;
        if (event.type === 'error') failed = true;
        yield event;
      }
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      failed = true;
      yield { type: 'error', code: 'provider_error', message: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      // neither message_done nor error means the stream was cut short: the Stop button.
      // (`signal` cannot tell us — Nest also aborts it when the response completes normally.)
      if (!stopReason && !failed) stopReason = 'aborted';
      // keep what the model managed to say, even after a Stop or an error
      if (text || !failed) {
        this.saveAnswer(conversationId, messageId, text, stopReason);
      }
    }
  }

  /** Saves the user message (and a placeholder title) and returns the history to send, including it. */
  private recordQuestion(conversationId: string, dto: SendMessageDto): LlmMessage[] {
    // throws before the first event, and Nest holds the SSE headers until then,
    // so an unknown conversation still comes back as a JSON 404
    const conversation = this.conversations.getOrThrow(conversationId);
    const history = this.conversations.listMessages(conversationId);

    this.conversations.appendMessage({
      id: newId('msg'),
      conversationId,
      role: 'user',
      content: dto.content,
      createdAt: new Date().toISOString(),
    });
    if (history.length === 0 && conversation.title === DEFAULT_TITLE) {
      // placeholder until LLM-generated titles arrive in phase 2
      this.conversations.setTitle(conversationId, truncateTitle(dto.content));
    }

    return [...history, { role: 'user' as const, content: dto.content }].map(({ role, content }) => ({ role, content }));
  }

  private saveAnswer(conversationId: string, id: string, content: string, stopReason?: StopReason): void {
    this.conversations.appendMessage({
      id,
      conversationId,
      role: 'assistant',
      content,
      ...(stopReason && { stopReason }),
      createdAt: new Date().toISOString(),
    });
  }
}

function truncateTitle(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}
