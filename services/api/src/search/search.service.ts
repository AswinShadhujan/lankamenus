import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { MEILISEARCH_INDEX_RESTAURANTS } from './constants';
import type { RestaurantSearchDocument } from './search-index.types';

const SEARCHABLE_ATTRIBUTES = [
  'name_default',
  'city',
  'district',
  'cuisine_tags',
  'menu_item_names',
  'menu_item_descriptions',
] as const;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private client: Meilisearch | null = null;
  private indexEnsured = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const host = this.config.get<string>('MEILISEARCH_HOST');
    if (host && host.trim() !== '') {
      this.client = new Meilisearch({
        host: host.trim(),
        apiKey: this.config.get<string>('MEILISEARCH_API_KEY') || undefined,
      });
    }
  }

  /** Whether Meilisearch is configured and available. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Meilisearch client, or null if not configured. */
  getClient(): Meilisearch | null {
    return this.client;
  }

  /** Index name for restaurant + menu search. */
  getRestaurantsIndexName(): string {
    return MEILISEARCH_INDEX_RESTAURANTS;
  }

  /**
   * Set searchable attributes on the restaurants index. Idempotent.
   * Call after adding documents so the index exists.
   */
  private async ensureSearchableAttributes(): Promise<void> {
    if (!this.client || this.indexEnsured) return;
    try {
      const index = this.client.index(MEILISEARCH_INDEX_RESTAURANTS);
      await index.updateSearchableAttributes([...SEARCHABLE_ATTRIBUTES]);
      this.indexEnsured = true;
    } catch (err) {
      this.logger.warn(
        `Meilisearch: could not set searchable attributes (${(err as Error).message})`,
      );
    }
  }

  /**
   * Build a Meilisearch document for a restaurant (with active menus and items).
   */
  async buildRestaurantDocument(restaurantId: number): Promise<RestaurantSearchDocument | null> {
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: restaurantId },
      include: {
        menus: {
          where: { is_active: true },
          include: {
            menu_sections: {
              orderBy: { sort_order: 'asc' },
              include: {
                menu_items: {
                  orderBy: { sort_order: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!restaurant) return null;

    const menuItemNames: string[] = [];
    const menuItemDescriptions: string[] = [];
    for (const menu of restaurant.menus) {
      for (const section of menu.menu_sections) {
        for (const item of section.menu_items) {
          menuItemNames.push(item.name);
          if (item.description && item.description.trim() !== '') {
            menuItemDescriptions.push(item.description.trim());
          }
        }
      }
    }

    return {
      id: restaurant.id,
      name_default: restaurant.name_default,
      city: restaurant.city,
      district: restaurant.district,
      cuisine_tags: restaurant.cuisine_tags ?? [],
      price_level: restaurant.price_level,
      veg_friendly: restaurant.veg_friendly,
      halal_certified: restaurant.halal_certified,
      menu_item_names: menuItemNames,
      menu_item_descriptions: menuItemDescriptions,
    };
  }

  /**
   * Add or update a restaurant in the Meilisearch index (inline sync).
   * No-op if Meilisearch is not configured. Logs and swallows errors so DB mutations still succeed.
   */
  async indexRestaurant(restaurantId: number): Promise<void> {
    if (!this.client) return;
    try {
      const doc = await this.buildRestaurantDocument(restaurantId);
      if (!doc) return;
      const index = this.client.index<RestaurantSearchDocument>(MEILISEARCH_INDEX_RESTAURANTS);
      await index.addDocuments([doc], { primaryKey: 'id' });
      await this.ensureSearchableAttributes();
    } catch (err) {
      this.logger.warn(
        `Meilisearch: failed to index restaurant ${restaurantId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Remove a restaurant from the Meilisearch index.
   * No-op if Meilisearch is not configured. Logs and swallows errors.
   */
  async deleteRestaurantFromIndex(restaurantId: number): Promise<void> {
    if (!this.client) return;
    try {
      const index = this.client.index(MEILISEARCH_INDEX_RESTAURANTS);
      await index.deleteDocument(restaurantId);
    } catch (err) {
      this.logger.warn(
        `Meilisearch: failed to delete restaurant ${restaurantId} from index: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Search the restaurants index by text query. Returns restaurant ids in relevance order.
   * Use when q is present and Meilisearch is configured.
   */
  async searchRestaurantIds(
    q: string,
    options: { limit?: number } = {},
  ): Promise<{ ids: number[]; totalHits: number }> {
    if (!this.client) return { ids: [], totalHits: 0 };
    const limit = Math.min(options.limit ?? 1000, 2000);
    const index = this.client.index<RestaurantSearchDocument>(MEILISEARCH_INDEX_RESTAURANTS);
    const res = await index.search(q, {
      limit,
      attributesToRetrieve: ['id'],
    });
    const ids = (res.hits ?? []).map((hit) => hit.id);
    const totalHits =
      'estimatedTotalHits' in res
        ? (res as { estimatedTotalHits: number }).estimatedTotalHits
        : 'totalHits' in res
          ? (res as { totalHits: number }).totalHits
          : ids.length;
    return { ids, totalHits };
  }
}
