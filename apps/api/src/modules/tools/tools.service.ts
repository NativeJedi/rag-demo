import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { DictionaryService } from './dictionary.service';
import { createDictionaryTools } from './dictionary.tools';
import { getCurrentDatetime } from './get-current-datetime.tool';
import type { ToolDefinition } from '../llm/llm-provider';
import type { Tool } from './tool';

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  toolUseId: string;
  /** JSON text for a result, a readable message for an error. */
  content: string;
  isError: boolean;
}

/** The assistant's tools: what the API is told about them, and running the model's calls. */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly byName: Map<string, Tool>;

  constructor(dictionary: DictionaryService) {
    const tools = [getCurrentDatetime, ...createDictionaryTools(dictionary)];
    this.byName = new Map(tools.map((tool) => [tool.name, tool]));
  }

  definitions(): ToolDefinition[] {
    return [...this.byName.values()].map(({ name, description, input }) => {
      const { $schema, ...inputSchema } = z.toJSONSchema(input);
      void $schema;
      return { name, description, inputSchema };
    });
  }

  /** Runs all calls of one model response concurrently; results keep the order of `calls`. Never rejects. */
  runAll(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.run(call)));
  }

  private async run({ id, name, input }: ToolCall): Promise<ToolResult> {
    this.logger.log(`call ${name} ${JSON.stringify(input)}`);
    const tool = this.byName.get(name);
    if (!tool) return this.fail(id, name, `Unknown tool: ${name}`);
    try {
      const content = JSON.stringify((await tool.execute(input)) ?? null);
      this.logger.log(`result ${name} ${content}`);
      return { toolUseId: id, content, isError: false };
    } catch (err) {
      const message = err instanceof z.ZodError ? `Invalid input: ${z.prettifyError(err)}` : errorMessage(err);
      return this.fail(id, name, message);
    }
  }

  private fail(toolUseId: string, name: string, message: string): ToolResult {
    this.logger.warn(`error ${name} ${message}`);
    return { toolUseId, content: message, isError: true };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
