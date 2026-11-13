import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotImplementedPhase } from '../../common/not-implemented';
import { ChatService } from './chat.service';
import { SendMessageBody } from './dto';
import { formatFrame, startHeartbeat } from './sse';

@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** SSE over a raw Express response (Nest's @Sse() is GET-only). */
  @Post(':id/messages')
  async send(
    @Param('id') id: string,
    @Body() body: SendMessageBody,
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    // client disconnect (or the Stop button aborting fetch) before we finished → abort the provider
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    const events = await this.chat.startTurn(id, body, abort.signal);

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const stopHeartbeat = startHeartbeat(res);
    try {
      for await (const event of events) {
        if (abort.signal.aborted) break;
        res.write(formatFrame(event));
        if (event.type === 'message_done' || event.type === 'error') break;
      }
    } finally {
      stopHeartbeat();
      // drain so ChatService can persist partial output after an abort
      await events.return(undefined);
      res.end();
    }
  }

  @Post(':id/title')
  title(): never {
    throw new NotImplementedPhase(2);
  }
}
