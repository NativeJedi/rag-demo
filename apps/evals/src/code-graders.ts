import type { Check } from './grade';

const MAX_WORDS = 120;
const FILLER_OPENER = /^\W*(sure|certainly|of course|absolutely|great question|good question)\b/i;

/** Deterministic checks of the tutor rules that need no judge. */
export function codeChecks(reply: string): Check[] {
  const text = reply.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return [
    { name: `at most ${MAX_WORDS} words`, passed: words <= MAX_WORDS, reason: `${words} words` },
    // trailing markdown (e.g. "**Ready?**") is fine
    { name: 'ends with a question', passed: /\?[\s*_"')]*$/.test(text) },
    { name: 'no filler opener', passed: !FILLER_OPENER.test(text) },
  ];
}
