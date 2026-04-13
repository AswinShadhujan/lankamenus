import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { AuthModule } from './auth/auth.module';
import { FavouritesModule } from './favourites/favourites.module';
import { MenusModule } from './menus/menus.module';
import { LocationsModule } from './locations/locations.module';
import { SearchModule } from './search/search.module';
import { DishesModule } from './dishes/dishes.module';
import { CacheModule } from './cache/cache.module';
import { GoogleModule } from './integrations/google/google.module';
import { StorageModule } from './storage/storage.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MediaModule } from './media/media.module';
import { BannersModule } from './banners/banners.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CombinedSearchController } from './restaurants/combined-search.controller';
import { envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    // Rate limit: 100 req/min per IP (login/register are rate-limited to mitigate brute force)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    RestaurantsModule,
    MenusModule,
    LocationsModule,
    SearchModule,
    DishesModule,
    CacheModule,
    GoogleModule,
    StorageModule,
    CloudinaryModule,
    MediaModule,
    BannersModule,
    AuthModule,
    FavouritesModule,
  ],
  controllers: [AppController, CombinedSearchController],
  providers: [
    AppService,
    AllExceptionsFilter,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
