import { z } from 'zod';

export const ID_PREFIXES = { conversation: 'conv', message: 'msg', attachment: 'att', document: 'doc' } as const;

const idSchema = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[0-9A-Za-z]+$`));

export const ConversationIdSchema = idSchema(ID_PREFIXES.conversation);
export const MessageIdSchema = idSchema(ID_PREFIXES.message);
export const AttachmentIdSchema = idSchema(ID_PREFIXES.attachment);
export const DocumentIdSchema = idSchema(ID_PREFIXES.document);
