import { Body, Controller, HttpCode, type MessageEvent, Param, RequestMethod, Sse, SseSignal } from '@nestjs/common';
import { from, map, type Observable } from 'rxjs';
import { createZodDto } from 'nestjs-zod';
import { SendMessageSchema } from '@chatbot/shared';
import { ChatService } from './chat.service';

class SendMessageBody extends createZodDto(SendMessageSchema) {}

@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /**
   * Streams the assistant turn as Server-Sent Events. Nest owns the transport:
   * headers, framing (`event:` + `data:`), backpressure and ending the response.
   * It holds the headers until the first event, so a throw inside the generator
   * still becomes a JSON error. Unsubscribing on a client disconnect closes the
   * generator, so `ChatService` still saves the partial reply.
   */
  @Sse(':id/messages', { method: RequestMethod.POST })
  @HttpCode(200)
  send(
    @Param('id') id: string,
    @Body() body: SendMessageBody,
    @SseSignal() signal: AbortSignal,
  ): Observable<MessageEvent> {
    return from(this.chat.streamReply(id, body, signal)).pipe(
      map((event) => ({ type: event.type, data: event })),
    );
  }
}
