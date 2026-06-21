import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEY_MENU, CACHE_PATTERN_RESTAURANTS_LIST, CACHE_TTL_ENTITY } from '../cache/cache-keys';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { MenuItemClickTrackerService } from './menu-item-click-tracker.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MediaService } from '../media/media.service';
import {
  buildDishPortionFields,
  PORTIONS_ADMIN_INCLUDE,
  PORTIONS_DETAIL_INCLUDE,
} from './portion.mapper';

/** Text match on dish `name` only (exact / prefix / includes; query already lowercased). */
function dishNameTextMatchScore(name: string, qLower: string): number {
  const t = name.trim().toLowerCase();
  if (!t || !qLower) return 0;
  if (t === qLower) return 5;
  if (t.startsWith(qLower)) return 4;
  if (t.includes(qLower)) return 3;
  return 0;
}

function dishPopularityScore(isPopular: boolean, isRecommended: boolean): number {
  let s = 0;
  if (isPopular) s += 3;
  if (isRecommended) s += 2;
  return s;
}

/** Restaurant popularity (generated column); NULL treated as 0. */
function dishRestaurantStrengthScore(popularScore: number | null | undefined): number {
  const p = popularScore != null && Number.isFinite(Number(popularScore)) ? Number(popularScore) : 0;
  return p * 0.1;
}

@Injectable()
export class MenusService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
    private cache: CacheService,
    private menuItemClickTracker: MenuItemClickTrackerService,
    private media: MediaService,
  ) {}

  /**
   * Admin menu editor: full tree for the restaurant’s primary menu (UI assumes one menu).
   * Picks an active menu (highest id if several), else latest menu by id. Creates default if none.
   */
  async getEditorMenuForRestaurant(restaurantId: number) {
    let menus = await this.findByRestaurant(restaurantId, false);
    if (menus.length === 0) {
      const created = await this.createMenu(restaurantId, {
        name: 'Menu',
        is_active: true,
      });
      menus = [created];
    }
    const actives = menus.filter((m) => m.is_active);
    const target =
      actives.length > 0
        ? [...actives].sort((a, b) => b.id - a.id)[0]
        : [...menus].sort((a, b) => b.id - a.id)[0];
    const menu = await this.findOne(target.id);
    return { menus, menu };
  }

  async findByRestaurant(restaurantId: number, activeOnly = true) {
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    const where: { restaurant_id: number; is_active?: boolean } = {
      restaurant_id: restaurantId,
    };
    if (activeOnly) where.is_active = true;
    return this.prisma.menus.findMany({
      where,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    if (this.cache.isConfigured()) {
      const cached = await this.cache.get(CACHE_KEY_MENU(id));
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore parse error
        }
      }
    }
    const menu = await this.prisma.menus.findUnique({
      where: { id },
      include: {
        menu_sections: {
          orderBy: { sort_order: 'asc' },
          include: {
            menu_items: {
              orderBy: { sort_order: 'asc' },
              include: {
                media_asset: true,
                ...PORTIONS_ADMIN_INCLUDE,
              },
            },
          },
        },
      },
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    if (this.cache.isConfigured()) {
      try {
        await this.cache.set(
          CACHE_KEY_MENU(id),
          JSON.stringify(menu),
          CACHE_TTL_ENTITY,
        );
      } catch {
        // ignore
      }
    }
    return menu;
  }

  async createMenu(restaurantId: number, dto: CreateMenuDto) {
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    const menu = await this.prisma.menus.create({
      data: {
        restaurant_id: restaurantId,
        name: dto.name,
        is_active: dto.is_active ?? true,
      },
    });
    await this.searchService.indexRestaurant(restaurantId);
    await this.invalidateMenuAndListCache(menu.id);
    return menu;
  }

  async updateMenu(id: number, dto: UpdateMenuDto) {
    try {
      const updated = await this.prisma.menus.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        },
      });
      await this.searchService.indexRestaurant(updated.restaurant_id);
      await this.invalidateMenuAndListCache(id);
      return updated;
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Menu not found');
      }
      throw err;
    }
  }

  async deleteMenu(id: number) {
    const menu = await this.prisma.menus.findUnique({
      where: { id },
      select: { restaurant_id: true },
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    try {
      await this.prisma.menus.delete({
        where: { id },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Menu not found');
      }
      throw err;
    }
    await this.searchService.indexRestaurant(menu.restaurant_id);
    await this.invalidateMenuAndListCache(id);
  }

  /** Invalidate cache for a menu and list caches (menu content affects search). */
  private async invalidateMenuAndListCache(menuId: number): Promise<void> {
    await this.cache.del(CACHE_KEY_MENU(menuId));
    await this.cache.delByPattern(CACHE_PATTERN_RESTAURANTS_LIST);
  }

  async createSection(menuId: number, dto: CreateSectionDto) {
    const menu = await this.prisma.menus.findUnique({
      where: { id: menuId },
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    const section = await this.prisma.menu_sections.create({
      data: {
        menu_id: menuId,
        name: dto.name,
        sort_order: dto.sort_order ?? 0,
      },
    });
    await this.searchService.indexRestaurant(menu.restaurant_id);
    await this.invalidateMenuAndListCache(menuId);
    return section;
  }

  async updateSection(menuId: number, sectionId: number, dto: UpdateSectionDto) {
    const section = await this.prisma.menu_sections.findFirst({
      where: { id: sectionId, menu_id: menuId },
      include: { menu: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    const updated = await this.prisma.menu_sections.update({
      where: { id: sectionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
      },
    });
    await this.searchService.indexRestaurant(section.menu.restaurant_id);
    await this.invalidateMenuAndListCache(menuId);
    return updated;
  }

  async deleteSection(menuId: number, sectionId: number) {
    const section = await this.prisma.menu_sections.findFirst({
      where: { id: sectionId, menu_id: menuId },
      include: { menu: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    await this.prisma.menu_sections.delete({
      where: { id: sectionId },
    });
    await this.searchService.indexRestaurant(section.menu.restaurant_id);
  }

  /**
   * Postgres SERIAL can fall behind MAX(id) after restores/imports or createMany with explicit ids
   * (see scripts/migrate-data.ts). Causes P2002 on insert; createItem does not pass `id`.
   * Manual fix: scripts/sql/fix-menu-items-id-sequence.sql
   */
  private async resyncMenuItemsIdSequence(): Promise<void> {
    await this.prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('menu_items', 'id'),
        COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1,
        false
      )
    `;
  }

  /** P2002 on insert: Prisma usually sets meta.modelName + meta.target; accept either shape. */
  private isMenuItemsIdP2002(e: unknown): boolean {
    if (!(e instanceof PrismaClientKnownRequestError) || e.code !== 'P2002') {
      return false;
    }
    const meta = e.meta as { modelName?: string; target?: string | string[] } | undefined;
    if (meta?.modelName === 'menu_items') return true;
    const t = meta?.target;
    return (
      (Array.isArray(t) && t.length === 1 && t[0] === 'id') ||
      t === 'id'
    );
  }

  async createItem(menuId: number, dto: CreateMenuItemDto) {
    const section = await this.prisma.menu_sections.findFirst({
      where: { id: dto.menu_section_id, menu_id: menuId },
      include: { menu: true },
    });
    if (!section) {
      throw new BadRequestException(
        'Section not found or does not belong to this menu',
      );
    }
    const data: Prisma.menu_itemsCreateInput = {
      menu_section: { connect: { id: dto.menu_section_id } },
      name: dto.name,
      description: dto.description ?? undefined,
      price: dto.price != null ? dto.price : undefined,
      currency: dto.currency ?? undefined,
      veg: dto.veg ?? undefined,
      is_available: dto.is_available ?? true,
      is_popular: dto.is_popular ?? false,
      is_recommended: dto.is_recommended ?? false,
      sort_order: dto.sort_order ?? 0,
      ingredients: dto.ingredients ?? [],
      rating: dto.rating ?? undefined,
      rating_count: dto.rating_count ?? undefined,
      image_url: dto.image_url ?? undefined,
    };
    let item;
    try {
      item = await this.prisma.menu_items.create({ data });
    } catch (e) {
      if (!this.isMenuItemsIdP2002(e)) throw e;
      await this.resyncMenuItemsIdSequence();
      item = await this.prisma.menu_items.create({ data });
    }
    await this.searchService.indexRestaurant(section.menu.restaurant_id);
    await this.invalidateMenuAndListCache(menuId);
    return item;
  }

  async updateItem(
    menuId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ) {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: itemId },
      include: { menu_section: { include: { menu: true } } },
    });
    if (!item || item.menu_section.menu_id !== menuId) {
      throw new NotFoundException('Menu item not found');
    }
    const data: Prisma.menu_itemsUpdateInput = {};
    if (dto.menu_section_id !== undefined) {
      const section = await this.prisma.menu_sections.findFirst({
        where: { id: dto.menu_section_id, menu_id: menuId },
      });
      if (!section) {
        throw new BadRequestException(
          'Section not found or does not belong to this menu',
        );
      }
      data.menu_section = { connect: { id: dto.menu_section_id } };
    }
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.veg !== undefined) data.veg = dto.veg;
    if (dto.is_available !== undefined) data.is_available = dto.is_available;
    if (dto.is_popular !== undefined) data.is_popular = dto.is_popular;
    if (dto.is_recommended !== undefined) data.is_recommended = dto.is_recommended;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.ingredients !== undefined) data.ingredients = dto.ingredients;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.rating_count !== undefined) data.rating_count = dto.rating_count;
    if (dto.image_url !== undefined) {
      data.image_url = dto.image_url ?? null;
      if (item.media_asset_id) {
        data.media_asset = { disconnect: true };
      }
    }

    const updated = await this.prisma.menu_items.update({
      where: { id: itemId },
      data,
    });
    if (dto.image_url !== undefined && item.media_asset_id) {
      try {
        await this.media.delete(item.media_asset_id);
      } catch {
        /* best-effort */
      }
    }
    await this.searchService.indexRestaurant(
      item.menu_section.menu.restaurant_id,
    );
    await this.invalidateMenuAndListCache(menuId);
    return updated;
  }

  async deleteItem(menuId: number, itemId: number) {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: itemId },
      include: { menu_section: { include: { menu: true } } },
    });
    if (!item || item.menu_section.menu_id !== menuId) {
      throw new NotFoundException('Menu item not found');
    }
    const restaurantId = item.menu_section.menu.restaurant_id;
    const mediaId = item.media_asset_id;
    await this.prisma.menu_items.delete({
      where: { id: itemId },
    });
    await this.searchService.indexRestaurant(restaurantId);
    await this.invalidateMenuAndListCache(menuId);
    if (mediaId) {
      try {
        await this.media.delete(mediaId);
      } catch {
        /* best-effort */
      }
    }
  }

  /** Public: get one menu item with section, menu, and restaurant context. */
  /**
   * Global dish search for GET /search: name, description, or ingredients (substring, case-insensitive).
   * Ranks in memory: text match, is_popular / is_recommended, restaurant.popular_score × 0.1.
   * Response shape is unchanged for clients.
   */
  async searchDishesGlobal(q: string, limit: number) {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const clamped = Math.min(Math.max(limit, 1), 50);
    const ql = trimmed.toLowerCase();
    /** Pull extra candidates so ranking can surface better matches without heavy SQL. */
    const candidateLimit = Math.min(150, Math.max(clamped * 15, 50));

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: number;
        name: string;
        price: Prisma.Decimal | null;
        image_url: string | null;
        menu_id: number;
        restaurant_id: number;
        restaurant_name: string;
        is_popular: boolean;
        is_recommended: boolean;
        popular_score: number | null;
      }>
    >(
      Prisma.sql`
        SELECT
          mi.id,
          mi.name,
          mi.price,
          COALESCE(ma.secure_url, mi.image_url) AS image_url,
          ms.menu_id,
          r.id AS restaurant_id,
          r.name_default AS restaurant_name,
          mi.is_popular AS is_popular,
          mi.is_recommended AS is_recommended,
          r.popular_score AS popular_score
        FROM menu_items mi
        LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
        INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
        INNER JOIN menus m ON ms.menu_id = m.id
        INNER JOIN restaurants r ON m.restaurant_id = r.id
        WHERE m.is_active = true
          AND mi.is_available = true
          AND (
            strpos(lower(mi.name), ${ql}) > 0
            OR (mi.description IS NOT NULL AND strpos(lower(mi.description), ${ql}) > 0)
            OR EXISTS (
              SELECT 1 FROM unnest(mi.ingredients) AS ing
              WHERE strpos(lower(ing), ${ql}) > 0
            )
          )
        ORDER BY r.popular_score DESC NULLS LAST, mi.is_popular DESC, mi.is_recommended DESC, mi.name ASC
        LIMIT ${candidateLimit}
      `,
    );

    type Scored = {
      row: (typeof rows)[number];
      score: number;
    };

    const scored: Scored[] = rows.map((row) => {
      const textMatchScore = dishNameTextMatchScore(row.name, ql);
      const popularityScore = dishPopularityScore(
        Boolean(row.is_popular),
        Boolean(row.is_recommended),
      );
      const restaurantStrength = dishRestaurantStrengthScore(row.popular_score);

      const score = textMatchScore + popularityScore + restaurantStrength;

      return { row, score };
    });

    scored.sort((a, b) => {
      const d = b.score - a.score;
      if (d !== 0) return d;
      return a.row.name.localeCompare(b.row.name);
    });

    return scored.slice(0, clamped).map(({ row: r }) => ({
      id: r.id,
      name: r.name,
      restaurant_id: r.restaurant_id,
      restaurant_name: r.restaurant_name,
      price: r.price != null ? Number(r.price) : null,
      image: r.image_url ?? null,
      menu_id: r.menu_id,
    }));
  }

  /** Admin: dish cover image via Cloudinary (clears legacy `image_url`). */
  async replaceItemCoverFromUpload(
    menuId: number,
    itemId: number,
    buffer: Buffer,
    mimeType: string | undefined,
    req: Request,
  ) {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: itemId },
      include: { menu_section: { include: { menu: true } } },
    });
    if (!item || item.menu_section.menu_id !== menuId) {
      throw new NotFoundException('Menu item not found');
    }
    const prevAssetId = item.media_asset_id;
    const asset = await this.media.uploadAndCreate(buffer, {
      folder: 'lankamenus/dishes',
      mimeType,
    });
    await this.prisma.menu_items.update({
      where: { id: itemId },
      data: {
        media_asset: { connect: { id: asset.id } },
        image_url: null,
      },
    });
    if (prevAssetId && prevAssetId !== asset.id) {
      try {
        await this.media.delete(prevAssetId);
      } catch {
        /* best-effort */
      }
    }
    await this.searchService.indexRestaurant(item.menu_section.menu.restaurant_id);
    await this.invalidateMenuAndListCache(menuId);
    return this.findOneItem(menuId, itemId, req);
  }

  /** Admin: dish cover image via external HTTPS URL (clears legacy `image_url`). */
  async replaceItemCoverFromExternalUrl(
    menuId: number,
    itemId: number,
    imageUrl: string,
    req: Request,
  ) {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: itemId },
      include: { menu_section: { include: { menu: true } } },
    });
    if (!item || item.menu_section.menu_id !== menuId) {
      throw new NotFoundException('Menu item not found');
    }
    const prevAssetId = item.media_asset_id;
    const asset = await this.media.createFromExternalUrl(imageUrl);
    await this.prisma.menu_items.update({
      where: { id: itemId },
      data: {
        media_asset: { connect: { id: asset.id } },
        image_url: null,
      },
    });
    if (prevAssetId && prevAssetId !== asset.id) {
      try {
        await this.media.delete(prevAssetId);
      } catch {
        /* best-effort */
      }
    }
    await this.searchService.indexRestaurant(item.menu_section.menu.restaurant_id);
    await this.invalidateMenuAndListCache(menuId);
    return this.findOneItem(menuId, itemId, req);
  }

  async findOneItem(menuId: number, itemId: number, req: Request) {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: itemId },
      include: {
        media_asset: true,
        ...PORTIONS_DETAIL_INCLUDE,
        menu_section: {
          include: {
            menu: {
              include: {
                restaurant: true,
              },
            },
          },
        },
      },
    });
    if (!item || item.menu_section.menu_id !== menuId) {
      throw new NotFoundException('Menu item not found');
    }
    const menu = item.menu_section.menu;
    if (!menu.is_active) {
      throw new NotFoundException('Menu item not found');
    }
    const restaurant = menu.restaurant;

    if (await this.menuItemClickTracker.shouldIncrementClick(itemId, req)) {
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE menu_items SET click_count = click_count + 1 WHERE id = ${itemId}`,
      );
    }

    const portionFields = buildDishPortionFields(item.menu_item_portions);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price != null ? Number(item.price) : null,
      currency: item.currency,
      portions: portionFields.portions,
      has_portions: portionFields.has_portions,
      veg: item.veg,
      sort_order: item.sort_order,
      ingredients: item.ingredients ?? [],
      is_available: item.is_available,
      is_popular: item.is_popular,
      is_recommended: item.is_recommended,
      rating: item.rating ?? null,
      rating_count: item.rating_count ?? 0,
      image_url: item.image_url ?? null,
      media_asset: item.media_asset
        ? {
            id: item.media_asset.id,
            source_type: item.media_asset.source_type,
            secure_url: item.media_asset.secure_url,
          }
        : null,
      display_image_url:
        item.media_asset?.secure_url?.trim() || item.image_url?.trim() || null,
      menu_section_id: item.menu_section_id,
      section_name: item.menu_section.name,
      section: item.menu_section.name,
      menu_id: menu.id,
      menu_name: menu.name,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name_default,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name_default,
        slug: restaurant.slug ?? null,
      },
    };
  }
}
