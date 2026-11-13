import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Block, ChatEvent, Message, SendMessageDto, StopReason, Usage } from '@chatbot/shared';
import { newId } from '../../common/ids';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { ConversationsService, DEFAULT_TITLE } from '../conversations/conversations.service';
import { LLM_PROVIDER, type LlmProvider, type LlmRequest } from '../llm/llm-provider';
import { loadPrompt } from './prompt-loader';

/** Folds ChatEvents into the blocks that get persisted (server-side mirror of the web reducer). */
class AssistantAccumulator {
  readonly blocks: Block[] = [];
  usage: Usage | undefined;
  stopReason: StopReason | undefined;
  model: string | undefined;

  apply(event: ChatEvent): void {
    switch (event.type) {
      case 'message_start':
        this.model = event.model;
        break;
      case 'text_delta':
      case 'thinking_delta': {
        const type = event.type === 'text_delta' ? 'text' : 'thinking';
        const last = this.blocks.at(-1);
        if (last?.type === type) last.text += event.text;
        else this.blocks.push({ type, text: event.text });
        break;
      }
      case 'tool_call':
        this.blocks.push({ type: 'tool_call', toolUseId: event.toolUseId, name: event.name, input: event.input });
        break;
      case 'tool_result':
        this.blocks.push({ type: 'tool_result', toolUseId: event.toolUseId, output: event.output, isError: event.isError });
        break;
      case 'citation': {
        const textBlock = [...this.blocks].reverse().find((b) => b.type === 'text');
        if (textBlock?.type === 'text') {
          const { citedText, source, blockIndex } = event;
          textBlock.citations = [...(textBlock.citations ?? []), { citedText, source, blockIndex }];
        }
        break;
      }
      case 'usage': {
        const { type: _type, ...usage } = event;
        this.usage = usage;
        break;
      }
      case 'message_done':
        this.stopReason = event.stopReason;
        break;
      case 'tool_call_start':
      case 'tool_call_delta':
      case 'error':
        break;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly capabilities: CapabilitiesService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  /**
   * Validates and records the user message, then returns the event stream for the turn.
   * Throws (→ 404) before any bytes are streamed if the conversation does not exist.
   */
  async startTurn(conversationId: string, dto: SendMessageDto, signal: AbortSignal): Promise<AsyncGenerator<ChatEvent>> {
    const conversation = await this.conversations.getOrThrow(conversationId);
    const history = await this.conversations.listMessages(conversationId);

    const userMessage: Message = {
      id: newId('message'),
      conversationId,
      role: 'user',
      blocks: [{ type: 'text', text: dto.content }],
      createdAt: new Date().toISOString(),
    };
    await this.conversations.appendMessage(userMessage);
    if (conversation.title === DEFAULT_TITLE && history.length === 0) {
      // placeholder until LLM-generated titles arrive in phase 2
      await this.conversations.setTitle(conversationId, truncateTitle(dto.content));
    }

    const settings = { ...conversation.settings, ...dto.options };
    const models = this.capabilities.get().models;
    const request: LlmRequest = {
      messages: [...history, userMessage].map((m) => ({ role: m.role, blocks: m.blocks })),
      system: settings.system ?? loadPrompt('system'),
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      model: settings.model,
      modelId: models.find((m) => m.alias === settings.model)?.id ?? settings.model,
    };
    return this.run(conversationId, request, signal);
  }

  private async *run(conversationId: string, request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const assistantId = newId('message');
    const acc = new AssistantAccumulator();
    let failed = false;

    try {
      for await (const event of this.llm.stream(request, signal)) {
        acc.apply(event);
        if (event.type === 'error') failed = true;
        // the persisted id is the one the client sees
        yield event.type === 'message_start' ? { ...event, messageId: assistantId } : event;
      }
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      failed = true;
      const message = err instanceof Error ? err.message : 'Unknown error';
      yield { type: 'error', code: 'provider_error', message, retryable: false };
    } finally {
      if (signal.aborted && !acc.stopReason) acc.stopReason = 'aborted';
      if (acc.blocks.length > 0 || !failed) {
        await this.conversations.appendMessage({
          id: assistantId,
          conversationId,
          role: 'assistant',
          blocks: acc.blocks,
          ...(acc.model && { model: acc.model }),
          ...(acc.usage && { usage: acc.usage }),
          ...(acc.stopReason && { stopReason: acc.stopReason }),
          createdAt: new Date().toISOString(),
        }).catch((e: unknown) => this.logger.error(`persist failed: ${String(e)}`));
      }
    }
  }
}

function truncateTitle(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}
