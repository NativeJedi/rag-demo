import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/config.module';
import { createDictionaryTools } from './dictionary.tools';
import { DictionaryService } from './dictionary.service';
import { ToolExecutor } from './tool-executor';
import { ToolRegistry } from './tool-registry';

let file: string;
const service = () => new DictionaryService({ DICTIONARY_FILE: file } as AppConfig);
const entry = (word: string, addedAt = '2026-11-27') => ({ word, translation: `${word}-uk`, addedAt });
const onDisk = async () => JSON.parse(await readFile(file, 'utf8')) as { word: string }[];

beforeEach(async () => {
  file = join(await mkdtemp(join(tmpdir(), 'dict-')), 'nested', 'dictionary.json');
});

describe('DictionaryService', () => {
  it('treats a missing file as empty and creates it on the first add', async () => {
    const dict = service();
    expect(await dict.list()).toEqual([]);
    expect(await dict.add([entry('Lucid')])).toEqual({ added: ['lucid'], skipped: [] });
    expect((await onDisk()).map((e) => e.word)).toEqual(['lucid']);
  });

  it('reports duplicates as skipped, also within one call and across case', async () => {
    const dict = service();
    await dict.add([entry('lucid')]);
    expect(await dict.add([entry('LUCID'), entry('ephemeral'), entry('Ephemeral')])).toEqual({
      added: ['ephemeral'],
      skipped: [
        { word: 'lucid', reason: 'already exists' },
        { word: 'ephemeral', reason: 'already exists' },
      ],
    });
  });

  it('keeps words across a restart (a new service on the same file)', async () => {
    await service().add([entry('lucid')]);
    expect((await service().list()).map((e) => e.word)).toEqual(['lucid']);
  });

  it('does not lose entries of parallel adds', async () => {
    const dict = service();
    await Promise.all([dict.add([entry('a')]), dict.add([entry('b')]), dict.add([entry('c')])]);
    expect((await onDisk()).map((e) => e.word).sort()).toEqual(['a', 'b', 'c']);
  });

  it('finds words, case-insensitively, and lists the missing ones', async () => {
    const dict = service();
    await dict.add([entry('lucid')]);
    const { found, missing } = await dict.find(['Lucid', 'ephemeral']);
    expect(found.map((e) => e.word)).toEqual(['lucid']);
    expect(missing).toEqual(['ephemeral']);
  });

  it('lists newest first: addedAt, then later insertion', async () => {
    const dict = service();
    await dict.add([entry('old', '2026-11-01'), entry('first', '2026-11-27'), entry('second', '2026-11-27')]);
    expect((await dict.list()).map((e) => e.word)).toEqual(['second', 'first', 'old']);
  });

  it('fails clearly on a corrupt file and does not overwrite it', async () => {
    const dict = service();
    await dict.add([entry('lucid')]);
    await writeFile(file, '{ not json');
    const fresh = service();
    await expect(fresh.list()).rejects.toThrow(/not valid/);
    await expect(fresh.add([entry('x')])).rejects.toThrow(/not valid/);
    expect(await readFile(file, 'utf8')).toBe('{ not json');
  });
});

describe('dictionary tools', () => {
  const setup = () => new ToolExecutor(new ToolRegistry(createDictionaryTools(service())));

  it('add_words → find_words → list_words round trip', async () => {
    const run = setup();
    const [added] = await run.runAll([{ id: '1', name: 'add_words', input: { entries: [entry('lucid')] } }]);
    expect(added).toMatchObject({ isError: false, content: '{"added":["lucid"],"skipped":[]}' });
    const [found, listed] = await run.runAll([
      { id: '2', name: 'find_words', input: { words: ['lucid', 'x'] } },
      { id: '3', name: 'list_words', input: {} },
    ]);
    expect(JSON.parse(found?.content ?? '')).toMatchObject({ missing: ['x'] });
    expect(JSON.parse(listed?.content ?? '').entries).toHaveLength(1);
  });

  it('returns an error result for a bad date or empty words', async () => {
    const results = await setup().runAll([
      { id: '1', name: 'add_words', input: { entries: [entry('x', 'yesterday')] } },
      { id: '2', name: 'find_words', input: { words: [] } },
    ]);
    expect(results.map((r) => r.isError)).toEqual([true, true]);
    expect(results[0]?.content).toMatch(/^Invalid input/);
  });
});
