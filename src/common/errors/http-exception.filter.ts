import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../logging/request-id.middleware.js';

interface ErrorBody {
  code: string;
  message: string;
  requestId: string;
  details?: unknown[];
  retryAfterSeconds?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${request.method} ${request.url} → ${status}: ${err.message}`, err.stack);
    }
    const body = this.toBody(exception, request.requestId ?? 'unknown');
    response.status(status).json(body);
  }

  private toBody(exception: unknown, requestId: string): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return { code: 'internalServerError', message: 'Internal server error', requestId };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { code: this.codeFromStatus(exception.getStatus()), message: response, requestId };
    }

    if (this.isErrorObject(response)) {
      const rawMessage = response.message;
      const details = Array.isArray(rawMessage)
        ? rawMessage.map((message: unknown) => ({ message: String(message) }))
        : undefined;
      const retryAfterSeconds =
        typeof response.retryAfterSeconds === 'number' &&
        Number.isFinite(response.retryAfterSeconds)
          ? response.retryAfterSeconds
          : undefined;
      return {
        code:
          typeof response.code === 'string'
            ? response.code
            : typeof response.error === 'string'
              ? this.camelCase(response.error)
              : this.codeFromStatus(exception.getStatus()),
        message: Array.isArray(rawMessage)
          ? 'Validation failed'
          : String(rawMessage ?? exception.message),
        requestId,
        ...(details ? { details } : {}),
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {})
      };
    }

    return {
      code: this.codeFromStatus(exception.getStatus()),
      message: exception.message,
      requestId
    };
  }

  private isErrorObject(value: unknown): value is {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    retryAfterSeconds?: unknown;
  } {
    return typeof value === 'object' && value !== null;
  }

  private codeFromStatus(status: number): string {
    const labels: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'badRequest',
      [HttpStatus.UNAUTHORIZED]: 'unauthorized',
      [HttpStatus.FORBIDDEN]: 'forbidden',
      [HttpStatus.NOT_FOUND]: 'notFound',
      [HttpStatus.CONFLICT]: 'conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessableEntity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'tooManyRequests'
    };
    return labels[status] ?? 'httpError';
  }

  private camelCase(value: string): string {
    return value
      .replace(/[^a-zA-Z0-9]+(.)/g, (_match, chr: string) => chr.toUpperCase())
      .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
  }
}
