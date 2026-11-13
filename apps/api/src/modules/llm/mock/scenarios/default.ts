import { finish, start, textDeltas, type Scenario } from './helpers';

export const defaultScenario: Scenario = (ctx) => {
  const quoted = ctx.input
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const text = `## Mock reply

You said:

${quoted}

This is a **scripted** response from the mock provider. It exercises the markdown renderer:

- bullet one with \`inline code\`
- bullet two with a [link](https://docs.claude.com)
- bullet three, *emphasised*

| Scenario | Shows |
| --- | --- |
| \`/mock thinking\` | a collapsible thinking panel |
| \`/mock tools\` | tool call cards |

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

Try \`/mock thinking\`, \`/mock tools\`, \`/mock citations\`, \`/mock long\` or \`/mock error\`.`;
  return [start(ctx), ...textDeltas(text), ...finish(ctx, text)];
};
