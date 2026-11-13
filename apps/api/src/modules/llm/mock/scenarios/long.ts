import { finish, start, textDeltas, type Scenario } from './helpers';

const SENTENCES = [
  'Streaming keeps the interface responsive while the model is still writing.',
  'Auto-scroll should follow the newest text until the reader scrolls away.',
  'A stop button must abort the request and keep whatever has arrived so far.',
  'Long answers stress layout, markdown rendering and memory in equal measure.',
  'Each paragraph here is generated deterministically so tests stay stable.',
];

export const longScenario: Scenario = (ctx) => {
  const paragraphs: string[] = [];
  let words = 0;
  let p = 1;
  while (words < 2000) {
    const body = Array.from({ length: 5 }, (_, i) => SENTENCES[(p + i) % SENTENCES.length]).join(' ');
    paragraphs.push(`### Section ${p}\n\n${body}`);
    words += body.split(/\s+/).length + 2;
    p += 1;
  }
  const text = paragraphs.join('\n\n');
  return [start(ctx), ...textDeltas(text, 3), ...finish(ctx, text)];
};
