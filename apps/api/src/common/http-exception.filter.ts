import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import type { ApiError } from '@chatbot/shared';

const CODES: Record<number, string> = {
  400: 'bad_request',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  501: 'not_implemented',
};

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const err = (value as { error: unknown }).error;
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

/** Every error leaves the API as `{ error: { code, message } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    let status = 500;
    let body: ApiError = { error: { code: 'internal_error', message: 'Internal server error' } };

    if (exception instanceof ZodValidationException) {
      status = 400;
      const zodError = exception.getZodError();
      const issues =
        zodError instanceof ZodError
          ? zodError.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
          : 'Invalid request';
      body = { error: { code: 'validation_error', message: issues } };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (isApiError(response)) body = response;
      else {
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null && 'message' in response
              ? String((response as { message: unknown }).message)
              : exception.message;
        body = { error: { code: CODES[status] ?? 'error', message } };
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json(body);
  }
}
