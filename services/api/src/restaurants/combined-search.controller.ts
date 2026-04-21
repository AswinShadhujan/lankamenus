import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from '../menus/menus.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';

/** Limits for combined navbar search (fast response). */
const COMBINED_RESTAURANT_LIMIT = 8;
const COMBINED_DISH_LIMIT = 8;

@Controller('search')
export class CombinedSearchController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly menusService: MenusService,
  ) {}

  private mapRestaurantRows(
    restaurantRows: Awaited<ReturnType<RestaurantsService['quickSearchCombined']>>,
  ) {
    return restaurantRows.map((r) => ({
      id: r.id,
      name_default: r.name_default,
      city: r.city ?? null,
      district: r.district ?? null,
      photo_reference: r.photo_reference ?? null,
      media_asset:
        (r as unknown as { media_asset?: { secure_url: string; source_type?: string } | null })
          .media_asset ?? null,
      cuisine_tags: r.cuisine_tags ?? [],
    }));
  }

  @Public()
  @Get()
  async combinedSearch(@Query() query: GlobalSearchQueryDto) {
    const q = query.q?.trim() ?? '';
    if (q.length === 0) {
      return { restaurants: [], dishes: [] };
    }

    const scope = query.scope;

    if (scope === 'dishes') {
      const dishes = await this.menusService.searchDishesGlobal(q, COMBINED_DISH_LIMIT);
      return { restaurants: [], dishes };
    }

    if (scope === 'restaurants') {
      const restaurantRows = await this.restaurantsService.quickSearchCombined(
        q,
        COMBINED_RESTAURANT_LIMIT,
      );
      return { restaurants: this.mapRestaurantRows(restaurantRows), dishes: [] };
    }

    const [restaurantRows, dishes] = await Promise.all([
      this.restaurantsService.quickSearchCombined(q, COMBINED_RESTAURANT_LIMIT),
      this.menusService.searchDishesGlobal(q, COMBINED_DISH_LIMIT),
    ]);

    return { restaurants: this.mapRestaurantRows(restaurantRows), dishes };
  }
}
