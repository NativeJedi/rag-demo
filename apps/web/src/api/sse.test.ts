import { describe, expect, it } from 'vitest';
import { createSseParser, type SseFrame } from './sse';

function parse(chunks: string[]): SseFrame[] {
  const frames: SseFrame[] = [];
  const p = createSseParser((f) => frames.push(f));
  chunks.forEach((c) => p.push(c));
  return frames;
}

describe('createSseParser', () => {
  it('parses a single frame', () => {
    expect(parse(['event: text_delta\ndata: {"a":1}\n\n'])).toEqual([{ event: 'text_delta', data: '{"a":1}' }]);
  });

  it('handles frames split at arbitrary byte boundaries', () => {
    const raw = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    for (let i = 1; i < raw.length; i++) {
      expect(parse([raw.slice(0, i), raw.slice(i)])).toEqual([
        { event: 'a', data: '1' },
        { event: 'b', data: '2' },
      ]);
    }
    expect(parse(raw.split(''))).toHaveLength(2);
  });

  it('ignores comment heartbeats', () => {
    expect(parse([': ping\n\n', 'event: x\ndata: y\n\n', ': ping\n\n'])).toEqual([{ event: 'x', data: 'y' }]);
  });

  it('joins multi-line data and supports CRLF', () => {
    expect(parse(['event: m\r\ndata: one\r\ndata: two\r\n\r\n'])).toEqual([{ event: 'm', data: 'one\ntwo' }]);
  });

  it('defaults the event name and does not emit incomplete frames', () => {
    expect(parse(['data: hi\n\n'])).toEqual([{ event: 'message', data: 'hi' }]);
    expect(parse(['event: a\ndata: 1\n'])).toEqual([]);
  });

  it('keeps colons inside data values', () => {
    expect(parse(['data: {"u":"http://x"}\n\n'])[0]?.data).toBe('{"u":"http://x"}');
  });
});
