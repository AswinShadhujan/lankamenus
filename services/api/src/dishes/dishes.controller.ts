import { Controller, Get, Logger, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DishesService } from './dishes.service';
import { DishGeoQueryDto } from './dto/dish-geo.query.dto';

@Controller('dishes')
export class DishesController {
  private readonly log = new Logger(DishesController.name);

  constructor(private readonly dishes: DishesService) {}

  @Public()
  @Get('featured')
  featured(@Query() query: DishGeoQueryDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.log.log(
        `[dish-district-debug] GET /dishes/featured district=${query.district ?? '∅'} lat=${query.lat ?? '∅'}`,
      );
    }
    return this.dishes.getFeatured(query);
  }

  @Public()
  @Get('trending')
  trending(@Query() query: DishGeoQueryDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.log.log(
        `[dish-district-debug] GET /dishes/trending district=${query.district ?? '∅'} lat=${query.lat ?? '∅'}`,
      );
    }
    return this.dishes.getTrending(query);
  }
}
