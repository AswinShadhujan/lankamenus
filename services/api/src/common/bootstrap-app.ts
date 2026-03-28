import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:19006',
];

const bootstrapLogger = new Logger('Bootstrap');

/**
 * Applies production-like middleware, filters, and pipes to the app.
 * Used by main.ts and e2e tests so both behave the same.
 */
export function applyProductionConfig(app: INestApplication): void {
  const configService = app.get(ConfigService);

  // Allow cross-origin <img> / fetch from web (e.g. Next :3000 loading API :3001 /restaurants/:id/photo).
  // Default Helmet CORP is same-origin and triggers NS_ERROR_DOM_CORP_FAILED in Firefox.
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

  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  const raw = corsOrigins
    ? corsOrigins.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const origin: string[] = [];
  for (const o of raw) {
    try {
      new URL(o);
      origin.push(o);
    } catch {
      bootstrapLogger.warn(
        `Invalid CORS origin skipped: "${o.slice(0, 80)}${o.length > 80 ? '...' : ''}"`,
      );
    }
  }

  app.enableCors({
    origin:
      origin.length > 0 ? origin : raw.length === 0 ? DEFAULT_CORS_ORIGINS : false,
    credentials: true,
  });
}
