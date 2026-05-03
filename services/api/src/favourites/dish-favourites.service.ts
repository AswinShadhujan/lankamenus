import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export type DishFavouriteListItem = {
  id: number;
  menu_id: number;
  name: string;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  restaurant_id: number;
  restaurant_name: string;
};

@Injectable()
export class DishFavouritesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List favourite dishes for a user (fields for list / detail UX).
   */
  async findAllByUserId(userId: number): Promise<DishFavouriteListItem[]> {
    const rows = await this.prisma.user_dish_favourites.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        menu_items: {
          include: {
            menu_section: {
              include: {
                menu: {
                  include: {
                    restaurant: {
                      select: { id: true, name_default: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => {
      const item = row.menu_items;
      const menu = item.menu_section.menu;
      const restaurant = menu.restaurant;
      return {
        id: item.id,
        menu_id: menu.id,
        name: item.name,
        price: item.price != null ? Number(item.price) : null,
        currency: item.currency?.trim() || 'LKR',
        image_url: item.image_url,
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name_default,
      };
    });
  }

  /**
   * Dish ids favourited by the user (for heart state).
   */
  async findDishIdsByUserId(userId: number): Promise<number[]> {
    const rows = await this.prisma.user_dish_favourites.findMany({
      where: { user_id: userId },
      select: { dish_id: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => r.dish_id);
  }

  /**
   * Add a dish favourite. Idempotent: duplicate (unique) is success (no 409).
   * Throws NotFoundException if the dish does not exist.
   */
  async add(userId: number, dishId: number): Promise<void> {
    const dish = await this.prisma.menu_items.findUnique({
      where: { id: dishId },
    });
    if (!dish) {
      throw new NotFoundException('Dish not found');
    }
    try {
      await this.prisma.user_dish_favourites.create({
        data: {
          user_id: userId,
          dish_id: dishId,
        },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Remove a dish favourite. Idempotent if not present.
   */
  async remove(userId: number, dishId: number): Promise<void> {
    await this.prisma.user_dish_favourites.deleteMany({
      where: {
        user_id: userId,
        dish_id: dishId,
      },
    });
  }
}
