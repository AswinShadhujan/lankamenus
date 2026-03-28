import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RESTAURANT_LIST_SELECT } from '../restaurants/restaurant-list.select';
import { SearchRestaurantsDto } from '../restaurants/dto/search-restaurants.dto';
import type { RestaurantSortMode } from './ranking.types';

/**
 * Ranking formulas (see PostgreSQL GENERATED columns on `restaurants`):
 *
 * - **top_rated**: `score = rating` (order by `rating` DESC)
 * - **popular**: `score = rating * ln(rating_count + 1)` → `popular_score`
 * - **trending**: `score = view_count*0.4 + favorite_count*0.4 + rating*rating_count*0.2` → `trending_score`
 *
 * Future: plug real-time signals (clicks, dwell) by updating denormalized counters or materialized scores.
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Map query params + context to a sort mode. Preserves legacy defaults:
   * - No sort + no location → created_at
   * - No sort + location → distance
   * - Text query + no explicit sort + no location → Meilisearch relevance when enabled
   */
  resolveSortMode(
    dto: SearchRestaurantsDto,
    hasLocation: boolean,
    hasTextQuery: boolean,
  ): RestaurantSortMode {
    const s = dto.sort?.trim();

    if (s === 'top_rated' || s === 'rating') return 'top_rated';
    if (s === 'popular') return 'popular';
    if (s === 'trending') return 'trending';
    if (s === 'price') return 'price';
    if (s === 'distance') return hasLocation ? 'distance' : 'default_created';

    if (!s) {
      if (hasLocation) return 'distance';
      if (hasTextQuery) return 'default_relevance';
      return 'default_created';
    }

    if (s === 'relevance') {
      return hasLocation ? 'distance' : 'default_relevance';
    }

    return hasLocation ? 'distance' : 'default_created';
  }

  /** True when Prisma should order by rating / popular_score / trending_score. */
  usesDbRankingSort(sortMode: RestaurantSortMode): boolean {
    return (
      sortMode === 'top_rated' ||
      sortMode === 'popular' ||
      sortMode === 'trending'
    );
  }

  getPrismaOrderBy(
    sortMode: RestaurantSortMode,
  ): Prisma.restaurantsOrderByWithRelationInput[] {
    const idTiebreak: Prisma.restaurantsOrderByWithRelationInput = {
      id: 'asc',
    };

    switch (sortMode) {
      case 'top_rated':
        return [
          { rating: { sort: 'desc', nulls: 'last' } },
          idTiebreak,
        ];
      case 'popular':
        return [
          { popular_score: { sort: 'desc', nulls: 'last' } },
          idTiebreak,
        ];
      case 'trending':
        return [{ trending_score: 'desc' }, idTiebreak];
      case 'price':
        return [
          { price_level: { sort: 'asc', nulls: 'last' } },
          idTiebreak,
        ];
      case 'distance':
        // Real distance order is applied in memory when geo is active.
        return [{ created_at: 'desc' }];
      case 'default_created':
      case 'default_relevance':
        return [{ created_at: 'desc' }];
      default:
        return [{ created_at: 'desc' }];
    }
  }

  logRankingApplied(sortMode: RestaurantSortMode): void {
    if (sortMode === 'popular') {
      this.logger.log('[Ranking] Popular calculated');
    } else if (sortMode === 'trending') {
      this.logger.log('[Ranking] Trending calculated');
    } else if (sortMode === 'top_rated') {
      this.logger.log('[Ranking] Top rated calculated');
    }
  }

  /**
   * Direct ranking queries (admin, jobs, tests). Prefer `GET /restaurants?sort=…` for API clients
   * so filters, pagination, cache, and geo stay consistent.
   */
  async getTopRated(
    where: Prisma.restaurantsWhereInput = {},
    opts: { skip?: number; take?: number } = {},
  ) {
    this.logRankingApplied('top_rated');
    return this.prisma.restaurants.findMany({
      where,
      orderBy: this.getPrismaOrderBy('top_rated'),
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      select: RESTAURANT_LIST_SELECT,
    });
  }

  async getPopular(
    where: Prisma.restaurantsWhereInput = {},
    opts: { skip?: number; take?: number } = {},
  ) {
    this.logRankingApplied('popular');
    return this.prisma.restaurants.findMany({
      where,
      orderBy: this.getPrismaOrderBy('popular'),
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      select: RESTAURANT_LIST_SELECT,
    });
  }

  async getTrending(
    where: Prisma.restaurantsWhereInput = {},
    opts: { skip?: number; take?: number } = {},
  ) {
    this.logRankingApplied('trending');
    return this.prisma.restaurants.findMany({
      where,
      orderBy: this.getPrismaOrderBy('trending'),
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      select: RESTAURANT_LIST_SELECT,
    });
  }
}
