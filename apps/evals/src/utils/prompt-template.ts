/** Replaces every `{{name}}` with its value. Values are inserted literally (no `$&`-style replacement patterns). */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, () => value),
    template,
  );
}
