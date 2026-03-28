import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { FavouritesService } from './favourites.service';
import { FavouritesController } from './favourites.controller';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [FavouritesController],
  providers: [FavouritesService],
  exports: [FavouritesService],
})
export class FavouritesModule {}
