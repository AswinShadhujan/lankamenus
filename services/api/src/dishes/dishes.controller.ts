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

  @Public()
  @Get('nearby')
  nearby(@Query() query: DishGeoQueryDto) {
    if (process.env.NODE_ENV !== 'production') {
      this.log.log(
        `[dish-district-debug] GET /dishes/nearby cuisine=${query.cuisine ?? '∅'} district=${query.district ?? '∅'} lat=${query.lat ?? '∅'}`,
      );
    }
    return this.dishes.getNearby(query);
  }

  /**
   * Keyword / category dish search (after static segments).
   * Expose both `/dishes` and `/dishes/search`: some setups fail to bind `GET '/'` reliably.
   */
  @Public()
  @Get('search')
  searchWithPath(@Query() query: DishGeoQueryDto) {
    return this.dishes.searchDishes(query);
  }

  @Public()
  @Get()
  searchRoot(@Query() query: DishGeoQueryDto) {
    return this.dishes.searchDishes(query);
  }
}
