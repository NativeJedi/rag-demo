import type { ChatEvent } from '@chatbot/shared';
import { finish, start, textDeltas, type Scenario } from './helpers';

function toolCall(toolUseId: string, name: string, input: unknown): ChatEvent[] {
  const json = JSON.stringify(input);
  const mid = Math.ceil(json.length / 2);
  return [
    { type: 'tool_call_start', toolUseId, name },
    { type: 'tool_call_delta', toolUseId, partialJson: json.slice(0, mid) },
    { type: 'tool_call_delta', toolUseId, partialJson: json.slice(mid) },
    { type: 'tool_call', toolUseId, name, input },
  ];
}

export const toolsScenario: Scenario = (ctx) => {
  const text =
    'I checked the weather and tried to read your notes. The weather lookup worked, ' +
    'but `notes/todo.md` does not exist, so that call returned an error.';
  return [
    start(ctx),
    ...textDeltas('Let me look that up.\n\n'),
    ...toolCall('toolu_mock_1', 'get_weather', { city: 'Berlin', unit: 'celsius' }),
    { type: 'tool_result', toolUseId: 'toolu_mock_1', output: { temperature: 14, condition: 'Cloudy' }, isError: false },
    ...toolCall('toolu_mock_2', 'read_file', { path: 'notes/todo.md' }),
    { type: 'tool_result', toolUseId: 'toolu_mock_2', output: 'ENOENT: no such file notes/todo.md', isError: true },
    ...textDeltas(text),
    ...finish(ctx, text),
  ];
};
