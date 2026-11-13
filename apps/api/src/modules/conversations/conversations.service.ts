import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Conversation,
  ConversationSummary,
  ConversationWithMessages,
  CreateConversationDto,
  Message,
  UpdateConversationDto,
} from '@chatbot/shared';
import { newId } from '../../common/ids';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { ConversationRepository, MessageRepository } from './conversation.repository';

export const DEFAULT_TITLE = 'New chat';

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(ConversationRepository) private readonly conversations: ConversationRepository,
    @Inject(MessageRepository) private readonly messages: MessageRepository,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async list(): Promise<ConversationSummary[]> {
    const all = await this.conversations.list();
    return all
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  async create(dto: CreateConversationDto): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: newId('conversation'),
      title: dto.title ?? DEFAULT_TITLE,
      createdAt: now,
      updatedAt: now,
      settings: { ...this.capabilities.get().defaults },
    };
    await this.conversations.save(conversation);
    return conversation;
  }

  async getOrThrow(id: string): Promise<Conversation> {
    const found = await this.conversations.get(id);
    if (!found) throw new NotFoundException(`Conversation ${id} not found`);
    return found;
  }

  async getWithMessages(id: string): Promise<ConversationWithMessages> {
    const conversation = await this.getOrThrow(id);
    return { ...conversation, messages: await this.messages.listByConversation(id) };
  }

  async update(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    const conversation = await this.getOrThrow(id);
    const next: Conversation = {
      ...conversation,
      title: dto.title ?? conversation.title,
      settings: { ...conversation.settings, ...dto.settings },
      updatedAt: new Date().toISOString(),
    };
    await this.conversations.save(next);
    return next;
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.conversations.delete(id);
    await this.messages.deleteByConversation(id);
  }

  listMessages(conversationId: string): Promise<Message[]> {
    return this.messages.listByConversation(conversationId);
  }

  /** Appends a message and bumps the conversation's updatedAt. */
  async appendMessage(message: Message): Promise<void> {
    await this.messages.append(message);
    const conversation = await this.getOrThrow(message.conversationId);
    await this.conversations.save({ ...conversation, updatedAt: new Date().toISOString() });
  }

  async setTitle(id: string, title: string): Promise<void> {
    const conversation = await this.getOrThrow(id);
    await this.conversations.save({ ...conversation, title });
  }
}
