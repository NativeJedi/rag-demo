import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Conversation,
  ConversationSummary,
  ConversationWithMessages,
  CreateConversationDto,
  Message,
} from '@chatbot/shared';
import { newId } from '../../common/ids';
import type { ContentBlock } from '../llm/llm-provider';

export const DEFAULT_TITLE = 'New chat';

/** What the server keeps: content as blocks. The web only ever sees `Message` (plain text). */
export type StoredMessage = Omit<Message, 'content'> & { blocks: ContentBlock[] };

function toMessage({ blocks, ...rest }: StoredMessage): Message {
  const content = blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { ...rest, content };
}

/**
 * The web sees plain text: tool_result messages are skipped, tool_use blocks are dropped and the
 * assistant messages of one tool turn are merged into one (text joined with a blank line, id of the first).
 */
function toMessages(stored: StoredMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of stored) {
    if (m.blocks.length > 0 && m.blocks.every((b) => b.type === 'tool_result')) continue;
    const message = toMessage(m);
    const prev = out.at(-1);
    if (m.role === 'assistant' && prev?.role === 'assistant') {
      out[out.length - 1] = {
        ...prev,
        content: [prev.content, message.content].filter(Boolean).join('\n\n'),
        ...(message.stopReason ? { stopReason: message.stopReason } : {}),
      };
    } else {
      out.push(message);
    }
  }
  return out;
}

/** In-memory store; SQLite (Drizzle) replaces the two maps in phase 3. */
@Injectable()
export class ConversationsService {
  private readonly conversations = new Map<string, Conversation>();
  private readonly messages = new Map<string, StoredMessage[]>();

  list(): ConversationSummary[] {
    return [...this.conversations.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  create(dto: CreateConversationDto): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: newId('conv'),
      title: dto.title ?? DEFAULT_TITLE,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  getOrThrow(id: string): Conversation {
    const found = this.conversations.get(id);
    if (!found) throw new NotFoundException(`Conversation ${id} not found`);
    return found;
  }

  getWithMessages(id: string): ConversationWithMessages {
    return { ...this.getOrThrow(id), messages: toMessages(this.listMessages(id)) };
  }

  remove(id: string): void {
    this.getOrThrow(id);
    this.conversations.delete(id);
    this.messages.delete(id);
  }

  /** A snapshot: callers must not see later appends through the array they got. */
  listMessages(conversationId: string): StoredMessage[] {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  /** Appends a message and bumps the conversation's updatedAt. */
  appendMessage(message: StoredMessage): void {
    const conversation = this.getOrThrow(message.conversationId);
    this.messages.get(conversation.id)?.push(message);
    this.conversations.set(conversation.id, { ...conversation, updatedAt: new Date().toISOString() });
  }

  setTitle(id: string, title: string): void {
    this.conversations.set(id, { ...this.getOrThrow(id), title });
  }
}
