import { AlertTriangle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { prettyJson } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Part } from './parts';

type ToolPart = Extract<Part, { kind: 'tool' }>;

function inputText(part: ToolPart): string {
  if (part.input !== undefined) return prettyJson(part.input);
  if (!part.inputJson) return '…';
  try {
    return prettyJson(JSON.parse(part.inputJson));
  } catch {
    return part.inputJson; // partial JSON while streaming
  }
}

export function ToolCallCard({ part }: { part: ToolPart }) {
  const status = part.result ? (part.result.isError ? 'error' : 'done') : 'running';
  return (
    <div
      className={cn('my-3 overflow-hidden rounded-xl border bg-surface text-sm', status === 'error' ? 'border-danger/60' : 'border-line')}
      data-testid="tool-card"
      data-status={status}
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
        <Wrench className="size-4 text-muted" />
        <span className="font-mono font-medium">{part.name}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 text-xs',
            status === 'error' ? 'text-danger' : status === 'done' ? 'text-success' : 'text-muted',
          )}
        >
          {status === 'running' && <Loader2 className="size-3.5 animate-spin" />}
          {status === 'done' && <CheckCircle2 className="size-3.5" />}
          {status === 'error' && <AlertTriangle className="size-3.5" />}
          {status === 'running' ? 'Running' : status === 'done' ? 'Done' : 'Error'}
        </span>
      </div>
      <Section label="Input">{inputText(part)}</Section>
      {part.result && (
        <Section label={part.result.isError ? 'Error' : 'Result'} error={part.result.isError}>
          {prettyJson(part.result.output)}
        </Section>
      )}
    </div>
  );
}

function Section({ label, error, children }: { label: string; error?: boolean; children: string }) {
  return (
    <div className="border-t border-line px-3 py-2 first:border-t-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <pre className={cn('max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs', error && 'text-danger')}>{children}</pre>
    </div>
  );
}
