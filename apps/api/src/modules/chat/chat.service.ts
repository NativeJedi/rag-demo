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

  /** One assistant turn: record the question, stream the answer, save what arrived. */
  async *streamReply(conversationId: string, dto: SendMessageDto, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    // throws before the first event, and Nest holds the SSE headers until then,
    // so an unknown conversation still comes back as a JSON 404
    const conversation = this.conversations.getOrThrow(conversationId);
    const history = this.conversations.listMessages(conversationId);

    this.conversations.appendMessage({
      id: newId('msg'),
      conversationId,
      role: 'user',
      blocks: [{ type: 'text', text: dto.content }],
      createdAt: new Date().toISOString(),
    });
    if (history.length === 0 && conversation.title === DEFAULT_TITLE) {
      // placeholder until LLM-generated titles arrive in phase 2
      this.conversations.setTitle(conversationId, truncateTitle(dto.content));
    }

    const messageId = newId('msg');
    const messages: LlmMessage[] = [
      ...history.map(({ role, blocks }) => ({ role, content: blocks })),
      { role: 'user', content: [{ type: 'text', text: dto.content }] },
    ];

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
        this.conversations.appendMessage({
          id: messageId,
          conversationId,
          role: 'assistant',
          blocks: [{ type: 'text', text }],
          ...(stopReason && { stopReason }),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}

function truncateTitle(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}
