import { z } from 'zod';
import type { DictionaryService } from './dictionary.service';
import { EntrySchema } from './dictionary.service';
import { defineTool } from './tool';

export function createDictionaryTools(dictionary: DictionaryService) {
  const findWords = defineTool({
    name: 'find_words',
    description: 'Checks which of the given words are already in the user\'s vocabulary dictionary. Returns the stored entries and the words that are missing.',
    input: z.object({ words: z.array(z.string().min(1)).min(1) }),
    run: ({ words }) => dictionary.find(words),
  });

  const addWords = defineTool({
    name: 'add_words',
    description: 'Saves new words to the vocabulary dictionary. `translation` is Ukrainian, `addedAt` is today\'s date (YYYY-MM-DD, from get_current_datetime). Words already in the dictionary are reported as skipped.',
    input: z.object({ entries: z.array(EntrySchema).min(1) }),
    run: ({ entries }) => dictionary.add(entries),
  });

  const listWords = defineTool({
    name: 'list_words',
    description: 'Lists every word in the vocabulary dictionary, newest first.',
    input: z.object({}),
    run: async () => ({ entries: await dictionary.list() }),
  });

  return [findWords, addWords, listWords];
}
