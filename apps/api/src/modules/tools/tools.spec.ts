import { describe, expect, it } from 'vitest';
import type { DictionaryService } from './dictionary.service';
import { ToolsService } from './tools.service';

const stub = (overrides: Partial<DictionaryService> = {}) => new ToolsService(overrides as DictionaryService);

describe('ToolsService.definitions', () => {
  const definitions = stub().definitions();

  it('exposes all four tools', () => {
    expect(definitions.map((d) => d.name)).toEqual(['get_current_datetime', 'find_words', 'add_words', 'list_words']);
  });

  it('turns zod schemas into JSON-schema definitions', () => {
    expect(definitions.find((d) => d.name === 'find_words')?.input_schema).toEqual({
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
    expect(await tools.runAll([{ type: 'tool_use' as const, id: 't1', name: 'find_words', input: { words: ['a'] } }])).toEqual([
      { type: 'tool_result', tool_use_id: 't1', content: '{"found":[],"missing":["a"]}', is_error: false },
    ]);
  });

  it('turns invalid input, unknown tools and thrown errors into error results', async () => {
    const tools = stub({
      list: async () => {
        throw new Error('kaboom');
      },
    });
    const results = await tools.runAll([
      { type: 'tool_use' as const, id: 't1', name: 'find_words', input: { words: [] } },
      { type: 'tool_use' as const, id: 't2', name: 'nope', input: {} },
      { type: 'tool_use' as const, id: 't3', name: 'list_words', input: {} },
    ]);
    expect(results.map((r) => r.is_error)).toEqual([true, true, true]);
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
      { type: 'tool_use' as const, id: 'a', name: 'find_words', input: { words: ['one'] } },
      { type: 'tool_use' as const, id: 'b', name: 'find_words', input: { words: ['two'] } },
    ]);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toEqual(['start one', 'start two']); // both started before either finished
    release();
    expect((await pending).map((r) => r.tool_use_id)).toEqual(['a', 'b']);
  });

});

describe('get_current_datetime', () => {
  it('returns iso and a YYYY-MM-DD date', async () => {
    const [result] = await stub().runAll([{ type: 'tool_use' as const, id: 't', name: 'get_current_datetime', input: {} }]);
    const { iso, date } = JSON.parse(result?.content ?? '') as { iso: string; date: string };
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(iso.startsWith(date)).toBe(true);
  });
});
