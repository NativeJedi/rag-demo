import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Conversation,
  ConversationSummary,
  ConversationWithMessages,
  CreateConversationDto,
  Message,
} from '@chatbot/shared';
import { newId } from '../../common/ids';

export const DEFAULT_TITLE = 'New chat';

/** In-memory store; SQLite (Drizzle) replaces the two maps in phase 3. */
@Injectable()
export class ConversationsService {
  private readonly conversations = new Map<string, Conversation>();
  private readonly messages = new Map<string, Message[]>();

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
    return { ...this.getOrThrow(id), messages: this.listMessages(id) };
  }

  remove(id: string): void {
    this.getOrThrow(id);
    this.conversations.delete(id);
    this.messages.delete(id);
  }

  /** A snapshot: callers must not see later appends through the array they got. */
  listMessages(conversationId: string): Message[] {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  /** Appends a message and bumps the conversation's updatedAt. */
  appendMessage(message: Message): void {
    const conversation = this.getOrThrow(message.conversationId);
    this.messages.get(conversation.id)?.push(message);
    this.conversations.set(conversation.id, { ...conversation, updatedAt: new Date().toISOString() });
  }

  setTitle(id: string, title: string): void {
    this.conversations.set(id, { ...this.getOrThrow(id), title });
  }
}
