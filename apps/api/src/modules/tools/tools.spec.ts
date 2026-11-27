import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getCurrentDatetime } from './get-current-datetime.tool';
import { defineTool } from './tool';
import { ToolExecutor } from './tool-executor';
import { ToolRegistry } from './tool-registry';

const echo = defineTool({
  name: 'echo',
  description: 'Echoes words',
  input: z.object({ words: z.array(z.string()).min(1) }),
  run: ({ words }) => ({ words }),
});
const boom = defineTool({ name: 'boom', description: 'Always fails', input: z.object({}), run: () => { throw new Error('kaboom'); } });

describe('ToolRegistry', () => {
  it('turns zod schemas into JSON-schema definitions', () => {
    const [def] = new ToolRegistry([echo]).definitions();
    expect(def).toEqual({
      name: 'echo',
      description: 'Echoes words',
      inputSchema: {
        type: 'object',
        properties: { words: { type: 'array', minItems: 1, items: { type: 'string' } } },
        required: ['words'],
        additionalProperties: false,
      },
    });
  });

  it('rejects duplicate names', () => {
    expect(() => new ToolRegistry([echo, echo])).toThrow(/Duplicate/);
  });
});

describe('ToolExecutor', () => {
  const executor = new ToolExecutor(new ToolRegistry([echo, boom, getCurrentDatetime]));

  it('runs a tool and returns JSON', async () => {
    expect(await executor.runAll([{ id: 't1', name: 'echo', input: { words: ['a'] } }])).toEqual([
      { toolUseId: 't1', content: '{"words":["a"]}', isError: false },
    ]);
  });

  it('turns invalid input, unknown tools and thrown errors into error results', async () => {
    const results = await executor.runAll([
      { id: 't1', name: 'echo', input: { words: [] } },
      { id: 't2', name: 'nope', input: {} },
      { id: 't3', name: 'boom', input: {} },
    ]);
    expect(results.map((r) => r.isError)).toEqual([true, true, true]);
    expect(results[0]?.content).toMatch(/^Invalid input/);
    expect(results[1]?.content).toBe('Unknown tool: nope');
    expect(results[2]?.content).toBe('kaboom');
  });

  it('runs calls concurrently and keeps their order', async () => {
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = defineTool({
      name: 'slow',
      description: 's',
      input: z.object({ n: z.number() }),
      run: async ({ n }) => {
        log.push(`start ${n}`);
        await gate;
        log.push(`end ${n}`);
        return n;
      },
    });
    const pending = new ToolExecutor(new ToolRegistry([slow])).runAll([
      { id: 'a', name: 'slow', input: { n: 1 } },
      { id: 'b', name: 'slow', input: { n: 2 } },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toEqual(['start 1', 'start 2']); // both started before either finished
    release();
    expect((await pending).map((r) => r.toolUseId)).toEqual(['a', 'b']);
  });
});

describe('get_current_datetime', () => {
  it('returns iso and a YYYY-MM-DD date', async () => {
    const result = (await getCurrentDatetime.execute({})) as { iso: string; date: string };
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.iso.startsWith(result.date)).toBe(true);
  });
});
