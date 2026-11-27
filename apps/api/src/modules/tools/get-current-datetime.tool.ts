import { z } from 'zod';
import { defineTool } from './tool';

export const getCurrentDatetime = defineTool({
  name: 'get_current_datetime',
  description: 'Returns the current server date and time in UTC. Use it whenever you need today\'s date.',
  input: z.object({}),
  run: () => {
    const iso = new Date().toISOString();
    return { iso, date: iso.slice(0, 10) };
  },
});
