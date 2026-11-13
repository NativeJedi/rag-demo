import { ulid } from 'ulid';
import { ID_PREFIXES } from '@chatbot/shared';

export function newId(kind: keyof typeof ID_PREFIXES): string {
  return `${ID_PREFIXES[kind]}_${ulid()}`;
}
