import type { Block, Citation } from '@chatbot/shared';

/** What the UI renders for an assistant message — built from stored blocks or from live events. */
export type Part =
  | { kind: 'text'; text: string; citations: Citation[] }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; toolUseId: string; name: string; inputJson: string; input?: unknown; result?: { output: unknown; isError: boolean } };

export function blocksToParts(blocks: Block[]): Part[] {
  const parts: Part[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        parts.push({ kind: 'text', text: block.text, citations: block.citations ?? [] });
        break;
      case 'thinking':
        parts.push({ kind: 'thinking', text: block.text });
        break;
      case 'tool_call':
        parts.push({ kind: 'tool', toolUseId: block.toolUseId, name: block.name, inputJson: JSON.stringify(block.input ?? {}), input: block.input });
        break;
      case 'tool_result': {
        const tool = parts.find((p) => p.kind === 'tool' && p.toolUseId === block.toolUseId);
        if (tool?.kind === 'tool') tool.result = { output: block.output, isError: block.isError };
        break;
      }
      case 'attachment':
        break; // attachments render from phase 7
    }
  }
  return parts;
}
