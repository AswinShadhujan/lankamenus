import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let body: { statusCode: number; message: string | string[] };

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'object' &&
        res !== null &&
        'message' in (res as object)
          ? (res as { message?: string | string[] }).message
          : exception.message;
      body = { statusCode, message: message ?? 'Error' };
      if (statusCode >= 500) {
        this.logger.error(exception);
      } else {
        this.logger.warn(
          `HTTP ${statusCode}: ${Array.isArray(message) ? message.join(', ') : message}`,
        );
      }
    } else if (
      exception instanceof PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      statusCode = HttpStatus.NOT_FOUND;
      body = { statusCode, message: 'Resource not found' };
      this.logger.warn('Resource not found (P2025)');
    } else if (
      exception instanceof PrismaClientKnownRequestError &&
      exception.code === 'P2022'
    ) {
      // Column/table missing — almost always pending migrations vs DATABASE_URL
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      body = {
        statusCode,
        message:
          'Database schema is out of date. From services/api run: pnpm exec prisma migrate deploy',
      };
      this.logger.error(exception);
    } else {
      this.logger.error(exception);
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { statusCode, message: 'Internal server error' };
    }

    httpAdapter.reply(response, body, statusCode);
  }
}
