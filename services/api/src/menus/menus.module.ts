import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { RestaurantMenusController } from './restaurant-menus.controller';
import { MenuItemClickTrackerService } from './menu-item-click-tracker.service';
import { SearchModule } from '../search/search.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    SearchModule,
    CacheModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [RestaurantMenusController, MenusController],
  providers: [MenusService, MenuItemClickTrackerService],
  exports: [MenusService],
})
export class MenusModule {}
