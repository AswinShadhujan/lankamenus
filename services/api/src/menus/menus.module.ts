import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { MenuItemPortionsController } from './menu-item-portions.controller';
import { RestaurantMenusController } from './restaurant-menus.controller';
import { MenuItemClickTrackerService } from './menu-item-click-tracker.service';
import { MenuItemPortionsService } from './menu-item-portions.service';
import { SearchModule } from '../search/search.module';
import { CacheModule } from '../cache/cache.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    SearchModule,
    CacheModule,
    MediaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [RestaurantMenusController, MenusController, MenuItemPortionsController],
  providers: [MenusService, MenuItemClickTrackerService, MenuItemPortionsService],
  exports: [MenusService],
})
export class MenusModule {}
