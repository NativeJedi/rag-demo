import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Tool } from './tool';

export const TOOLS = Symbol('TOOLS');

/** Tool definition in the shape the Messages API wants. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

@Injectable()
export class ToolRegistry {
  private readonly byName = new Map<string, Tool>();

  constructor(@Inject(TOOLS) tools: Tool[]) {
    for (const tool of tools) {
      if (this.byName.has(tool.name)) throw new Error(`Duplicate tool name: ${tool.name}`);
      this.byName.set(tool.name, tool);
    }
  }

  get(name: string): Tool | undefined {
    return this.byName.get(name);
  }

  definitions(): ToolDefinition[] {
    return [...this.byName.values()].map(({ name, description, input }) => {
      const { $schema, ...inputSchema } = z.toJSONSchema(input);
      void $schema;
      return { name, description, inputSchema };
    });
  }
}
