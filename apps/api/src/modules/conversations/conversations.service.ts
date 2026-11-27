import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Conversation,
  ConversationSummary,
  ConversationWithMessages,
  CreateConversationDto,
  Message,
} from '@chatbot/shared';
import { newId } from '../../common/ids';
import type { LlmMessage } from '../llm/llm-provider';

export const DEFAULT_TITLE = 'New chat';

/** What the server keeps: content as blocks. The web only ever sees `Message` (plain text). */
export type StoredMessage = Omit<Message, 'content'> & LlmMessage;

/** A message to store: the service adds `conversationId` and `createdAt`, and an `id` unless one is given. */
export type NewMessage = Pick<StoredMessage, 'role' | 'content' | 'stopReason'> & { id?: string };

function toMessage({ content: blocks, ...rest }: StoredMessage): Message {
  const content = blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { ...rest, content };
}

/**
 * The web sees plain text: tool_result messages are skipped, tool_use blocks are dropped and the
 * assistant messages of one tool turn are merged into one (their text concatenated, id of the first).
 */
function toMessages(stored: StoredMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of stored) {
    if (m.content.length > 0 && m.content.every((b) => b.type === 'tool_result')) continue;
    const message = toMessage(m);
    const prev = out.at(-1);
    if (m.role === 'assistant' && prev?.role === 'assistant') {
      out[out.length - 1] = {
        ...prev,
        content: prev.content + message.content,
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

  /**
   * Appends a message, filling in `conversationId` and `createdAt`, and bumps the conversation's updatedAt.
   * The id is generated unless the caller already announced one (the assistant's id goes out in `message_start`).
   */
  appendMessage(conversationId: string, { id, ...message }: NewMessage): void {
    const conversation = this.getOrThrow(conversationId);
    const now = new Date().toISOString();
    this.messages.get(conversationId)?.push({ ...message, id: id ?? newId('msg'), conversationId, createdAt: now });
    this.conversations.set(conversationId, { ...conversation, updatedAt: now });
  }

  setTitle(id: string, title: string): void {
    this.conversations.set(id, { ...this.getOrThrow(id), title });
  }
}
