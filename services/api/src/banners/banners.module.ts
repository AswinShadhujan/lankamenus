import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';

@Module({
  imports: [MediaModule],
  controllers: [BannersController],
  providers: [BannersService],
})
export class BannersModule {}
