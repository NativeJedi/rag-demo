import { z } from 'zod';

/** A tool as the registry and executor see it: raw input in, JSON-able result out. */
export interface Tool {
  name: string;
  description: string;
  /** Zod schema of the input; it becomes the JSON schema sent to the API. */
  input: z.ZodType;
  /** Validates the raw model input, then runs the tool. Throws on invalid input. */
  execute(rawInput: unknown): Promise<unknown>;
}

export interface ToolSpec<S extends z.ZodType> {
  name: string;
  description: string;
  input: S;
  run(input: z.output<S>): unknown | Promise<unknown>;
}

/** Keeps `run` typed by the schema while the rest of the code deals with plain `Tool`s. */
export function defineTool<S extends z.ZodType>(spec: ToolSpec<S>): Tool {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    execute: async (rawInput) => spec.run(spec.input.parse(rawInput)),
  };
}
