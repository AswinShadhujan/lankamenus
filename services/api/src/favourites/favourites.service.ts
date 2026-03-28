import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { CacheService } from '../cache/cache.service';
import { CACHE_PATTERN_RESTAURANTS_LIST } from '../cache/cache-keys';

@Injectable()
export class FavouritesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * List favourite restaurants for a user (full restaurant objects for list UX).
   */
  async findAllByUserId(userId: number) {
    const rows = await this.prisma.favourites.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { restaurant: true },
    });
    return rows.map((r) => r.restaurant);
  }

  /**
   * Add a favourite. Idempotent: if already favourited, no-op (success).
   * Throws NotFoundException if restaurant does not exist.
   * Keeps `restaurants.favorite_count` in sync for trending_score.
   */
  async add(userId: number, restaurantId: number): Promise<void> {
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.favourites.create({
          data: {
            user_id: userId,
            restaurant_id: restaurantId,
          },
        });
        await tx.restaurants.update({
          where: { id: restaurantId },
          data: { favorite_count: { increment: 1 } },
        });
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Unique constraint: already favourited; idempotent success
        return;
      }
      throw err;
    }
    await this.invalidateRankingListCaches();
  }

  /**
   * Remove a favourite. Idempotent: if not favourited, no-op (success).
   */
  async remove(userId: number, restaurantId: number): Promise<void> {
    const result = await this.prisma.favourites.deleteMany({
      where: {
        user_id: userId,
        restaurant_id: restaurantId,
      },
    });
    if (result.count > 0) {
      await this.prisma.$executeRaw`
        UPDATE restaurants
        SET favorite_count = GREATEST(0, favorite_count - 1)
        WHERE id = ${restaurantId}
      `;
      await this.invalidateRankingListCaches();
    }
  }

  private async invalidateRankingListCaches(): Promise<void> {
    if (!this.cache.isConfigured()) return;
    try {
      await this.cache.delByPattern(CACHE_PATTERN_RESTAURANTS_LIST);
    } catch {
      /* best-effort */
    }
  }
}
