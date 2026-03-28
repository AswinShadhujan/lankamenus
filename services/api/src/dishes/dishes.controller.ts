import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DishesService } from './dishes.service';
import { DishGeoQueryDto } from './dto/dish-geo.query.dto';

@Controller('dishes')
export class DishesController {
  constructor(private readonly dishes: DishesService) {}

  @Public()
  @Get('featured')
  featured(@Query() query: DishGeoQueryDto) {
    return this.dishes.getFeatured(query);
  }

  @Public()
  @Get('trending')
  trending(@Query() query: DishGeoQueryDto) {
    return this.dishes.getTrending(query);
  }
}
