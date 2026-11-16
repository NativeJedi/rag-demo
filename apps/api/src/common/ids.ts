import { ulid } from 'ulid';

/** Prefixed IDs so a stray id is readable in logs: `conv_01J…`, `msg_01J…`. */
export function newId(prefix: 'conv' | 'msg'): string {
  return `${prefix}_${ulid()}`;
}
