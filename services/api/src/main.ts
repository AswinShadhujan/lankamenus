import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyProductionConfig } from './common/bootstrap-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyProductionConfig(app);

  const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;
  await app.listen(port);
  console.log(`🚀 API listening on port ${port}`);
}
bootstrap();
