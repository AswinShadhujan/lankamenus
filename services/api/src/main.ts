import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable CORS for your local dev environments
  app.enableCors({
    origin: [
      'http://localhost:3000',   // Next.js web
      'http://localhost:19006',  // Expo web
      'http://127.0.0.1:19006',  // Expo alternative
    ],
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3001;

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}
bootstrap();
