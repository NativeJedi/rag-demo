import type { ChatEvent } from '@chatbot/shared';

export const HEARTBEAT_MS = 15_000;

export interface Writable {
  write(chunk: string): unknown;
}

/** One SSE frame per SPEC §6: `event: <type>\ndata: <json>\n\n`. */
export function formatFrame(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Sends `: ping` comments so proxies keep the connection open. Returns a stop function. */
export function startHeartbeat(out: Writable, intervalMs = HEARTBEAT_MS): () => void {
  const timer = setInterval(() => out.write(': ping\n\n'), intervalMs);
  return () => clearInterval(timer);
}
