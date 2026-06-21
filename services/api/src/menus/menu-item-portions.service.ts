import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEY_MENU, CACHE_PATTERN_RESTAURANTS_LIST } from '../cache/cache-keys';
import { CreateMenuItemPortionDto } from './dto/create-menu-item-portion.dto';
import { UpdateMenuItemPortionDto } from './dto/update-menu-item-portion.dto';
import { mapPortion } from './portion.mapper';

@Injectable()
export class MenuItemPortionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly cache: CacheService,
  ) {}

  private async syncMinimumPrice(menuItemId: number): Promise<void> {
    const portions = await this.prisma.menu_item_portions.findMany({
      where: { menu_item_id: menuItemId, is_available: true },
      orderBy: { price: 'asc' },
      take: 1,
    });
    if (portions.length === 0) return;
    await this.prisma.menu_items.update({
      where: { id: menuItemId },
      data: { price: portions[0].price },
    });
  }

  private async assertMenuItemExists(menuItemId: number) {
    const item = await this.prisma.menu_items.findUnique({
      where: { id: menuItemId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  private async invalidateAfterPortionChange(menuItemId: number): Promise<void> {
    const item = await this.prisma.menu_items.findFirst({
      where: { id: menuItemId },
      include: { menu_section: { include: { menu: true } } },
    });
    if (!item) return;
    await this.searchService.indexRestaurant(item.menu_section.menu.restaurant_id);
    await this.cache.del(CACHE_KEY_MENU(item.menu_section.menu_id));
    await this.cache.delByPattern(CACHE_PATTERN_RESTAURANTS_LIST);
  }

  async listPortions(menuItemId: number) {
    await this.assertMenuItemExists(menuItemId);
    const portions = await this.prisma.menu_item_portions.findMany({
      where: { menu_item_id: menuItemId },
      orderBy: [{ sort_order: 'asc' }, { price: 'asc' }],
    });
    return { portions: portions.map(mapPortion) };
  }

  async createPortion(menuItemId: number, dto: CreateMenuItemPortionDto) {
    await this.assertMenuItemExists(menuItemId);
    const portion = await this.prisma.menu_item_portions.create({
      data: {
        menu_item_id: menuItemId,
        name: dto.name.trim(),
        price: dto.price,
        sort_order: dto.sort_order ?? 0,
        ...(dto.serves != null ? { serves: dto.serves } : {}),
      },
    });
    await this.syncMinimumPrice(menuItemId);
    await this.invalidateAfterPortionChange(menuItemId);
    return mapPortion(portion);
  }

  async updatePortion(
    menuItemId: number,
    portionId: number,
    dto: UpdateMenuItemPortionDto,
  ) {
    const existing = await this.prisma.menu_item_portions.findFirst({
      where: { id: portionId, menu_item_id: menuItemId },
    });
    if (!existing) {
      throw new NotFoundException('Portion not found');
    }
    const portion = await this.prisma.menu_item_portions.update({
      where: { id: portionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.is_available !== undefined ? { is_available: dto.is_available } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
        ...(dto.serves !== undefined ? { serves: dto.serves } : {}),
      },
    });
    await this.syncMinimumPrice(menuItemId);
    await this.invalidateAfterPortionChange(menuItemId);
    return mapPortion(portion);
  }

  async deletePortion(menuItemId: number, portionId: number) {
    const existing = await this.prisma.menu_item_portions.findFirst({
      where: { id: portionId, menu_item_id: menuItemId },
    });
    if (!existing) {
      throw new NotFoundException('Portion not found');
    }
    await this.prisma.menu_item_portions.delete({
      where: { id: portionId },
    });
    await this.syncMinimumPrice(menuItemId);
    await this.invalidateAfterPortionChange(menuItemId);
    return { success: true as const };
  }
}
