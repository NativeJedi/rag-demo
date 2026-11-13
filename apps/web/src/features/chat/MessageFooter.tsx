import type { StopReason, Usage } from '@chatbot/shared';
import { formatTokens } from '../../lib/format';

const STOP_LABELS: Record<StopReason, string> = {
  end_turn: 'Completed',
  max_tokens: 'Stopped: token limit reached',
  tool_use: 'Waiting for tool',
  stop_sequence: 'Stopped: stop sequence',
  aborted: 'Stopped by you',
};

export function MessageFooter({ stopReason, usage, model }: { stopReason?: StopReason; usage?: Usage; model?: string }) {
  if (!stopReason && !usage) return null;
  const bits: string[] = [];
  if (usage) {
    bits.push(`${formatTokens(usage.inputTokens)} in`, `${formatTokens(usage.outputTokens)} out`);
    if (usage.cacheReadTokens) bits.push(`${formatTokens(usage.cacheReadTokens)} cache read`);
    if (usage.cacheWriteTokens) bits.push(`${formatTokens(usage.cacheWriteTokens)} cache write`);
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" data-testid="message-footer">
      {stopReason && <span className={stopReason === 'aborted' || stopReason === 'max_tokens' ? 'text-accent' : ''}>{STOP_LABELS[stopReason]}</span>}
      {bits.length > 0 && <span>{bits.join(' · ')} tokens</span>}
      {model && <span className="font-mono">{model}</span>}
    </div>
  );
}
