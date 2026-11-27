import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

export const EntrySchema = z.object({
  word: z.string().trim().min(1),
  translation: z.string().trim().min(1),
  example: z.string().trim().min(1).optional(),
  addedAt: z.iso.date(),
});
export type Entry = z.infer<typeof EntrySchema>;

export interface AddResult {
  added: string[];
  skipped: { word: string; reason: string }[];
}

// src/modules/tools (and dist/modules/tools) → apps/api; relative DICTIONARY_FILE values resolve from there
const API_DIR = resolve(__dirname, '..', '..', '..');

/** The vocabulary dictionary: a JSON array on disk, loaded on first use. `word` (lowercased) is the key. */
@Injectable()
export class DictionaryService {
  private readonly file: string;
  private loaded: Promise<Entry[]> | undefined;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.file = resolve(API_DIR, config.DICTIONARY_FILE);
  }

  async find(words: string[]): Promise<{ found: Entry[]; missing: string[] }> {
    const entries = await this.load();
    const wanted = [...new Set(words.map(normalize))];
    const found = wanted.flatMap((w) => entries.filter((e) => e.word === w));
    return { found, missing: wanted.filter((w) => !found.some((e) => e.word === w)) };
  }

  /** Newest first: by `addedAt`, then the one inserted later. */
  async list(): Promise<Entry[]> {
    const entries = await this.load();
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => b.entry.addedAt.localeCompare(a.entry.addedAt) || b.index - a.index)
      .map(({ entry }) => entry);
  }

  /** Adds new words, reports duplicates as skipped. Calls are chained, so parallel adds cannot lose entries. */
  add(candidates: Entry[]): Promise<AddResult> {
    const result = this.writes.then(() => this.addNow(candidates));
    this.writes = result.catch(() => undefined);
    return result;
  }

  private async addNow(candidates: Entry[]): Promise<AddResult> {
    const entries = await this.load();
    const result: AddResult = { added: [], skipped: [] };
    const fresh: Entry[] = [];
    for (const candidate of candidates) {
      const word = normalize(candidate.word);
      if (entries.some((e) => e.word === word) || fresh.some((e) => e.word === word)) {
        result.skipped.push({ word, reason: 'already exists' });
      } else {
        fresh.push({ ...candidate, word });
        result.added.push(word);
      }
    }
    if (fresh.length > 0) {
      await this.save([...entries, ...fresh]);
      entries.push(...fresh);
    }
    return result;
  }

  private load(): Promise<Entry[]> {
    this.loaded ??= this.read().catch((err: unknown) => {
      this.loaded = undefined; // do not cache a failure: the file may be fixed later
      throw err;
    });
    return this.loaded;
  }

  private async read(): Promise<Entry[]> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    try {
      return z.array(EntrySchema).parse(JSON.parse(raw));
    } catch {
      // never overwrite it: the user may want to repair the file by hand
      throw new Error(`Dictionary file ${this.file} is not valid; fix or remove it`);
    }
  }

  private async save(entries: Entry[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(entries, null, 2)}\n`);
    await rename(tmp, this.file);
  }
}

function normalize(word: string): string {
  return word.trim().toLowerCase();
}
