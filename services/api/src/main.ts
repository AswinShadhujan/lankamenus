import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyProductionConfig } from './common/bootstrap-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyProductionConfig(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
}
bootstrap();
