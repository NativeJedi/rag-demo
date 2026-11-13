import type { Conversation, Message } from '@chatbot/shared';

/** Storage seam: in-memory in phase 1, SQLite (Drizzle) in phase 3. */
export abstract class ConversationRepository {
  abstract list(): Promise<Conversation[]>;
  abstract get(id: string): Promise<Conversation | undefined>;
  abstract save(conversation: Conversation): Promise<void>;
  abstract delete(id: string): Promise<boolean>;
}

export abstract class MessageRepository {
  abstract listByConversation(conversationId: string): Promise<Message[]>;
  abstract append(message: Message): Promise<void>;
  abstract deleteByConversation(conversationId: string): Promise<void>;
}
