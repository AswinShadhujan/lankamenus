import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';

/**
 * Applies production-like middleware, filters, and pipes to the app.
 * Used by main.ts and e2e tests so both behave the same.
 */
export function applyProductionConfig(app: INestApplication): void {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(requestLoggerMiddleware);
  app.useGlobalFilters(app.get(AllExceptionsFilter));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });
}
