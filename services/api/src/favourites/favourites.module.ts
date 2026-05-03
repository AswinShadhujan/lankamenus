import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { FavouritesService } from './favourites.service';
import { FavouritesController } from './favourites.controller';
import { DishFavouritesService } from './dish-favourites.service';
@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [FavouritesController],
  providers: [FavouritesService, DishFavouritesService],
  exports: [FavouritesService, DishFavouritesService],
})
export class FavouritesModule {}
