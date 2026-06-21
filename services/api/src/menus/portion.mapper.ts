import type { menu_item_portions, Prisma } from '@prisma/client';

const portionOrderBy: Prisma.menu_item_portionsOrderByWithRelationInput[] = [
  { sort_order: 'asc' },
  { price: 'asc' },
];

export type PortionResponse = {
  id: number;
  name: string;
  price: number;
  is_available: boolean;
  sort_order: number;
  serves: number | null;
};

export type PortionRailResponse = {
  id: number;
  name: string;
  price: number;
};

export const PORTIONS_DETAIL_INCLUDE = {
  menu_item_portions: {
    where: { is_available: true },
    orderBy: portionOrderBy,
  },
} satisfies Prisma.menu_itemsInclude;

export const PORTIONS_ADMIN_INCLUDE = {
  menu_item_portions: {
    orderBy: portionOrderBy,
  },
} satisfies Prisma.menu_itemsInclude;

export function mapPortion(p: menu_item_portions): PortionResponse {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    is_available: p.is_available,
    sort_order: p.sort_order,
    serves: p.serves,
  };
}

export function mapPortionRail(p: {
  id: number;
  name: string;
  price: menu_item_portions['price'];
}): PortionRailResponse {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
  };
}

export function buildDishPortionFields(
  portions: menu_item_portions[],
  options?: { railOnly?: boolean },
): {
  portions: PortionResponse[] | PortionRailResponse[];
  has_portions: boolean;
} {
  const has_portions = portions.length > 0;
  if (options?.railOnly) {
    return {
      has_portions,
      portions: portions.map(mapPortionRail),
    };
  }
  return {
    has_portions,
    portions: portions.map(mapPortion),
  };
}
