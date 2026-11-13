export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser. Feed it decoded text chunks of any size;
 * it calls `onFrame` for every completed frame. Comments (`: ping`) are ignored.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void): { push(chunk: string): void } {
  let buffer = '';
  let event = 'message';
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onFrame({ event, data: data.join('\n') });
    event = 'message';
    data = [];
  };

  const handleLine = (line: string) => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  };

  return {
    push(chunk) {
      buffer += chunk;
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\n|\r/.exec(buffer))) {
        // a trailing \r might be the first half of \r\n: wait for more input
        if (match[0] === '\r' && match.index === buffer.length - 1) return;
        const line = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        handleLine(line);
      }
    },
  };
}
