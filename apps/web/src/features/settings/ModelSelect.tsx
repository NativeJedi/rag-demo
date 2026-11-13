import type { ModelAlias } from '@chatbot/shared';
import { useCapabilities } from '../../lib/capabilities';

export function ModelSelect({ value, onChange }: { value: ModelAlias; onChange: (alias: ModelAlias) => void }) {
  const { models } = useCapabilities();
  return (
    <select
      aria-label="Model"
      value={value}
      onChange={(e) => onChange(e.target.value as ModelAlias)}
      className="h-9 max-w-40 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus-visible:border-accent sm:max-w-none"
    >
      {models.map((m) => (
        <option key={m.alias} value={m.alias}>
          {m.label} · {m.id}
        </option>
      ))}
    </select>
  );
}
