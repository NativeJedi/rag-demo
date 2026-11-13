import { useState } from 'react';
import type { Conversation, ConversationSettings } from '@chatbot/shared';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { useCapabilities } from '../../lib/capabilities';
import { ModelSelect } from './ModelSelect';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  onSave: (settings: Partial<ConversationSettings>) => void;
}

export function SettingsDrawer({ open, onClose, conversation, onSave }: SettingsDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title="Conversation settings">
      <SettingsForm key={conversation.id} conversation={conversation} onSave={(s) => { onSave(s); onClose(); }} />
    </Drawer>
  );
}

function SettingsForm({ conversation, onSave }: { conversation: Conversation; onSave: (s: Partial<ConversationSettings>) => void }) {
  const { features } = useCapabilities();
  const s = conversation.settings;
  const [model, setModel] = useState(s.model);
  const [system, setSystem] = useState(s.system ?? '');
  const [temperature, setTemperature] = useState(s.temperature);
  const [maxTokens, setMaxTokens] = useState(s.maxTokens);
  const [thinking, setThinking] = useState(s.thinking?.enabled ?? false);
  const [budget, setBudget] = useState(s.thinking?.budgetTokens ?? 2048);

  const save = () =>
    onSave({
      model,
      system: system.trim() || undefined,
      temperature,
      maxTokens: Math.min(64000, Math.max(1, Math.round(maxTokens) || 1)),
      ...(features.thinking && { thinking: { enabled: thinking, budgetTokens: Math.max(1, Math.round(budget) || 1) } }),
    });

  return (
    <form
      className="flex flex-col gap-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Model">
        <ModelSelect value={model} onChange={setModel} />
      </Field>
      <Field label="System prompt" hint="Leave empty to use the default prompt.">
        <textarea
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          rows={6}
          placeholder="You are a helpful assistant…"
          className="w-full resize-y rounded-lg border border-line bg-bg p-2.5 text-sm outline-none focus-visible:border-accent"
        />
      </Field>
      <Field label={`Temperature: ${temperature.toFixed(1)}`} hint="Lower is more deterministic, higher is more varied.">
        <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-accent" />
      </Field>
      <Field label="Max tokens">
        <input type="number" min={1} max={64000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-sm outline-none focus-visible:border-accent" />
      </Field>
      <fieldset disabled={!features.thinking} className="flex flex-col gap-3 disabled:opacity-50">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} className="size-4 accent-accent" />
          Extended thinking
          {!features.thinking && <span className="text-xs font-normal text-muted">(not available yet)</span>}
        </label>
        <Field label="Thinking budget (tokens)">
          <input type="number" min={1} value={budget} disabled={!thinking} onChange={(e) => setBudget(Number(e.target.value))} className="h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-sm outline-none focus-visible:border-accent disabled:opacity-60" />
        </Field>
      </fieldset>
      <Button type="submit" variant="primary">Save settings</Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
