import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChatEvent, SendMessageDto, StopReason } from '@chatbot/shared';
import { newId } from '../../common/ids';
import { ConversationsService, DEFAULT_TITLE, type StoredMessage } from '../conversations/conversations.service';
import { LLM_PROVIDER, type ContentBlock, type LlmMessage, type LlmProvider, type ToolUseBlock } from '../llm/llm-provider';
import { ToolsService } from '../tools/tools.service';

/** Model calls per user message (each tool round is one more call). */
const MAX_ITERATIONS = 8;
const ITERATION_SEPARATOR = '\n\n';

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
    const conversation = this.conversations.getOrThrow(conversationId);
    const history = this.conversations.listMessages(conversationId);

    const userBlocks: ContentBlock[] = [{ type: 'text', text: dto.content }];
    this.conversations.appendMessage({
      id: newId('msg'),
      conversationId,
      role: 'user',
      blocks: userBlocks,
      createdAt: new Date().toISOString(),
    });
    if (history.length === 0 && conversation.title === DEFAULT_TITLE) {
      // placeholder until LLM-generated titles arrive in phase 2
      this.conversations.setTitle(conversationId, truncateTitle(dto.content));
    }

    const messageId = newId('msg');
    const messages = toLlmMessages(history);
    messages.push({ role: 'user', content: userBlocks });
    const tools = this.tools.definitions();

    let assistantId = messageId; // id of the assistant message being streamed
    let text = ''; // its text so far
    let turnText = ''; // text of the whole turn, to separate iterations
    let stopReason: StopReason | undefined;
    let failed = false;

    yield { type: 'message_start', messageId };
    try {
      for (let iteration = 1; ; iteration++) {
        if (iteration > MAX_ITERATIONS) {
          failed = true;
          yield { type: 'error', code: 'tool_loop_limit', message: `Stopped after ${MAX_ITERATIONS} model calls` };
          break;
        }

        let toolUses: ToolUseBlock[] = [];
        for await (const event of this.llm.stream({ messages, tools }, signal)) {
          switch (event.type) {
            case 'text_delta':
              if (text === '' && turnText !== '') {
                turnText += ITERATION_SEPARATOR;
                yield { type: 'text_delta', text: ITERATION_SEPARATOR };
              }
              text += event.text;
              turnText += event.text;
              yield event;
              break;
            case 'tool_use':
              toolUses = event.blocks;
              break;
            case 'message_done':
              stopReason = event.stopReason;
              yield event;
              break;
            case 'error':
              failed = true;
              yield event;
              break;
          }
        }
        if (toolUses.length === 0 || failed || signal.aborted) break;

        // the tool_use message is stored only together with its results: the API rejects unanswered tool calls
        const results = await this.tools.runAll(toolUses.map(({ id, name, input }) => ({ id, name, input })));
        const assistant: LlmMessage = {
          role: 'assistant',
          content: [...(text ? [{ type: 'text' as const, text }] : []), ...toolUses],
        };
        const answers: LlmMessage = {
          role: 'user',
          content: results.map((r) => ({ type: 'tool_result', toolUseId: r.toolUseId, content: r.content, isError: r.isError })),
        };
        this.store(conversationId, { id: assistantId, role: 'assistant', blocks: assistant.content });
        this.store(conversationId, { id: newId('msg'), role: 'user', blocks: answers.content });
        messages.push(assistant, answers);
        assistantId = newId('msg');
        text = '';
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
        this.store(conversationId, {
          id: assistantId,
          role: 'assistant',
          blocks: text ? [{ type: 'text', text }] : [],
          ...(stopReason && { stopReason }),
        });
      }
    }
  }

  private store(conversationId: string, message: Pick<StoredMessage, 'id' | 'role' | 'blocks' | 'stopReason'>): void {
    this.conversations.appendMessage({ ...message, conversationId, createdAt: new Date().toISOString() });
  }
}

/** History for the model: messages without content (an assistant cut off before its first word) are left out. */
function toLlmMessages(stored: StoredMessage[]): LlmMessage[] {
  return stored.filter((m) => m.blocks.length > 0).map(({ role, blocks }) => ({ role, content: blocks }));
}

function truncateTitle(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}
