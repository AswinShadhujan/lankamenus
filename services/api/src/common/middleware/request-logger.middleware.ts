import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('HttpRequest');

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const method = req.method;
    const statusCode = res.statusCode;
    if (process.env.NODE_ENV === 'production') {
      const path = req.path ?? (req.url ? req.url.split('?')[0] : '');
      logger.log(
        JSON.stringify({ method, path, statusCode, durationMs }),
      );
    } else {
      const url = req.originalUrl ?? req.url;
      logger.log(`${method} ${url} ${statusCode} ${durationMs}ms`);
    }
  });
  next();
}
