import { describe, expect, it } from 'vitest';
import type { DictionaryService } from './dictionary.service';
import { getCurrentDatetime } from './get-current-datetime.tool';
import { ToolsService } from './tools.service';

const stub = (overrides: Partial<DictionaryService> = {}) => new ToolsService(overrides as DictionaryService);

describe('ToolsService.definitions', () => {
  const definitions = stub().definitions();

  it('exposes all four tools', () => {
    expect(definitions.map((d) => d.name)).toEqual(['get_current_datetime', 'find_words', 'add_words', 'list_words']);
  });

  it('turns zod schemas into JSON-schema definitions', () => {
    expect(definitions.find((d) => d.name === 'find_words')?.inputSchema).toEqual({
      type: 'object',
      properties: { words: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } } },
      required: ['words'],
      additionalProperties: false,
    });
  });
});

describe('ToolsService.runAll', () => {
  it('runs a tool and returns JSON', async () => {
    const tools = stub({ find: async () => ({ found: [], missing: ['a'] }) });
    expect(await tools.runAll([{ id: 't1', name: 'find_words', input: { words: ['a'] } }])).toEqual([
      { toolUseId: 't1', content: '{"found":[],"missing":["a"]}', isError: false },
    ]);
  });

  it('turns invalid input, unknown tools and thrown errors into error results', async () => {
    const tools = stub({
      list: async () => {
        throw new Error('kaboom');
      },
    });
    const results = await tools.runAll([
      { id: 't1', name: 'find_words', input: { words: [] } },
      { id: 't2', name: 'nope', input: {} },
      { id: 't3', name: 'list_words', input: {} },
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
    const tools = stub({
      find: async ([word]) => {
        log.push(`start ${word}`);
        await gate;
        return { found: [], missing: [] };
      },
    });
    const pending = tools.runAll([
      { id: 'a', name: 'find_words', input: { words: ['one'] } },
      { id: 'b', name: 'find_words', input: { words: ['two'] } },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toEqual(['start one', 'start two']); // both started before either finished
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
