import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ToolRegistry } from './tool-registry';

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

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(private readonly registry: ToolRegistry) {}

  /** Runs all calls of one model response concurrently; results keep the order of `calls`. Never rejects. */
  runAll(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.run(call)));
  }

  private async run({ id, name, input }: ToolCall): Promise<ToolResult> {
    this.logger.log(`call ${name} ${JSON.stringify(input)}`);
    const tool = this.registry.get(name);
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
