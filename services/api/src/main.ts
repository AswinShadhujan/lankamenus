import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { applyProductionConfig } from './common/bootstrap-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyProductionConfig(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3001;

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}
bootstrap();
