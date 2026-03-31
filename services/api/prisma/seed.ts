import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurants.upsert({
    where: { slug: 'railway-seed-restaurant' },
    update: {},
    create: {
      name_default: 'Railway Seed Restaurant',
      slug: 'railway-seed-restaurant',
      city: 'Colombo',
      district: 'Colombo',
      address_line1: 'Seed Street 1',
      cuisine_tags: ['Sri Lankan'],
      price_level: 2,
    },
  });

  const menu = await prisma.menus.findFirst({
    where: { restaurant_id: restaurant.id, name: 'Main Menu' },
  }) ?? await prisma.menus.create({
    data: {
      restaurant_id: restaurant.id,
      name: 'Main Menu',
      is_active: true,
    },
  });

  const section = await prisma.menu_sections.findFirst({
    where: { menu_id: menu.id, name: 'Popular' },
  }) ?? await prisma.menu_sections.create({
    data: {
      menu_id: menu.id,
      name: 'Popular',
      sort_order: 0,
    },
  });

  const existingItem = await prisma.menu_items.findFirst({
    where: { menu_section_id: section.id, name: 'Chicken Kottu' },
  });

  if (!existingItem) {
    await prisma.menu_items.create({
      data: {
        menu_section_id: section.id,
        name: 'Chicken Kottu',
        description: 'Seed item for production verification',
        price: 1200,
        currency: 'LKR',
        is_available: true,
      },
    });
  }

  console.log('Seed complete:', { restaurantId: restaurant.id, menuId: menu.id, sectionId: section.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
