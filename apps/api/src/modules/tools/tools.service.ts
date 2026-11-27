import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { DictionaryService, EntrySchema } from './dictionary.service';
import type { ToolDefinition, ToolResultBlock, ToolUseBlock } from '../llm/llm-provider';

const FindWordsInput = z.object({ words: z.array(z.string().min(1)).min(1) });
const AddWordsInput = z.object({ entries: z.array(EntrySchema).min(1) });
const NoInput = z.object({});

/** What the API is told about a tool, plus the code that runs its `tool_use`. `run` validates the raw input itself. */
interface Tool extends ToolDefinition {
  run(input: unknown): unknown;
}

/** The assistant's tools: what the API is told about them, and running the model's calls. */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  private readonly tools: Tool[] = [
    {
      name: 'get_current_datetime',
      description: 'Returns the current server date and time in UTC. Use it whenever you need today\'s date.',
      input_schema: inputSchema(NoInput),
      run: () => {
        const iso = new Date().toISOString();
        return { iso, date: iso.slice(0, 10) };
      },
    },
    {
      name: 'find_words',
      description: 'Checks which of the given words are already in the user\'s vocabulary dictionary. Returns the stored entries and the words that are missing.',
      input_schema: inputSchema(FindWordsInput),
      run: (input) => this.dictionary.find(FindWordsInput.parse(input).words),
    },
    {
      name: 'add_words',
      description: 'Saves new words to the vocabulary dictionary. `translation` is Ukrainian, `addedAt` is today\'s date (YYYY-MM-DD, from get_current_datetime). Words already in the dictionary are reported as skipped.',
      input_schema: inputSchema(AddWordsInput),
      run: (input) => this.dictionary.add(AddWordsInput.parse(input).entries),
    },
    {
      name: 'list_words',
      description: 'Lists every word in the vocabulary dictionary, newest first.',
      input_schema: inputSchema(NoInput),
      run: async () => ({ entries: await this.dictionary.list() }),
    },
  ];

  constructor(private readonly dictionary: DictionaryService) {}

  /** Sent to the API as `tools`; the model answers with `tool_use { name, input }`. */
  definitions(): ToolDefinition[] {
    return this.tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  }

  /** Runs all calls of one model response concurrently; results keep the order of `calls`. Never rejects. */
  runAll(calls: ToolUseBlock[]): Promise<ToolResultBlock[]> {
    return Promise.all(calls.map((call) => this.run(call)));
  }

  /** One `tool_use` block in, one `tool_result` block out: JSON text on success, a readable message on error. */
  private async run({ id, name, input }: ToolUseBlock): Promise<ToolResultBlock> {
    this.logger.log(`call ${name} ${JSON.stringify(input)}`);
    try {
      const tool = this.tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      const content = JSON.stringify((await tool.run(input)) ?? null);
      this.logger.log(`result ${name} ${content}`);
      return { type: 'tool_result', tool_use_id: id, content, is_error: false };
    } catch (err) {
      const content = err instanceof z.ZodError ? `Invalid input: ${z.prettifyError(err)}` : errorMessage(err);
      this.logger.warn(`error ${name} ${content}`);
      return { type: 'tool_result', tool_use_id: id, content, is_error: true };
    }
  }
}

function inputSchema(schema: z.ZodType): ToolDefinition['input_schema'] {
  const { $schema, ...rest } = z.toJSONSchema(schema);
  void $schema;
  return { ...rest, type: 'object' };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
