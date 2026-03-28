import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { SearchModule } from '../search/search.module';
import { CacheModule } from '../cache/cache.module';
import { GoogleModule } from '../integrations/google/google.module';
import { RankingModule } from '../ranking/ranking.module';
import { MenusModule } from '../menus/menus.module';

@Module({
  imports: [SearchModule, CacheModule, GoogleModule, RankingModule, MenusModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
