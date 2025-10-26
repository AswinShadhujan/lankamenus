import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RestaurantsModule } from './restaurants/restaurants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // ✅ Loads .env automatically
    PrismaModule,                             // ✅ Prisma DB connector
    RestaurantsModule,                        // (we’ll create this soon)
  ],
})
export class AppModule {}
