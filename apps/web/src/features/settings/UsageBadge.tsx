import { Coins } from 'lucide-react';
import type { Message } from '@chatbot/shared';
import { formatTokens, sumUsage } from '../../lib/format';

export function UsageBadge({ messages }: { messages: Message[] }) {
  const total = sumUsage(messages.map((m) => m.usage));
  if (total.inputTokens + total.outputTokens === 0) return null;
  const cache = (total.cacheReadTokens ?? 0) + (total.cacheWriteTokens ?? 0);
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted sm:inline-flex"
      title={`Input ${total.inputTokens} · Output ${total.outputTokens}${cache ? ` · Cache ${cache}` : ''}`}
      data-testid="usage-badge"
    >
      <Coins className="size-3.5" />
      {formatTokens(total.inputTokens)} in · {formatTokens(total.outputTokens)} out
    </span>
  );
}
