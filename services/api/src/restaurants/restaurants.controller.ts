import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get()
  search(@Query() query: SearchRestaurantsDto) {
    return this.restaurantsService.search(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.restaurantsService.findOne(id);
  }
}
