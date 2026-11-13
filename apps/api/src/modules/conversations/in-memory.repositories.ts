import { Injectable } from '@nestjs/common';
import type { Conversation, Message } from '@chatbot/shared';
import { ConversationRepository, MessageRepository } from './conversation.repository';

@Injectable()
export class InMemoryConversationRepository extends ConversationRepository {
  private readonly items = new Map<string, Conversation>();

  async list(): Promise<Conversation[]> {
    return [...this.items.values()].map((c) => structuredClone(c));
  }
  async get(id: string): Promise<Conversation | undefined> {
    const found = this.items.get(id);
    return found && structuredClone(found);
  }
  async save(conversation: Conversation): Promise<void> {
    this.items.set(conversation.id, structuredClone(conversation));
  }
  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

@Injectable()
export class InMemoryMessageRepository extends MessageRepository {
  private readonly items = new Map<string, Message[]>();

  async listByConversation(conversationId: string): Promise<Message[]> {
    return structuredClone(this.items.get(conversationId) ?? []);
  }
  async append(message: Message): Promise<void> {
    const list = this.items.get(message.conversationId) ?? [];
    list.push(structuredClone(message));
    this.items.set(message.conversationId, list);
  }
  async deleteByConversation(conversationId: string): Promise<void> {
    this.items.delete(conversationId);
  }
}
