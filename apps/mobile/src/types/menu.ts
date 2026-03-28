export interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  veg?: boolean | null;
  sort_order: number;
}

export interface MenuSection {
  id: number;
  name: string;
  sort_order: number;
  menu_items: MenuItem[];
}

export interface Menu {
  id: number;
  restaurant_id: number;
  name: string;
  is_active: boolean;
  menu_sections: MenuSection[];
}

export interface MenuListItem {
  id: number;
  restaurant_id: number;
  name: string;
  is_active: boolean;
}

/** Restaurant summary in dish detail response. */
export interface DishDetailRestaurant {
  id: number;
  name: string;
  slug: string | null;
}

/** Response from GET /menus/:menuId/items/:itemId (dish detail with context). */
export interface DishDetail {
  id: number;
  name: string;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  veg?: boolean | null;
  sort_order: number;
  ingredients: string[];
  rating: number | null;
  rating_count: number;
  image_url: string | null;
  menu_section_id: number;
  section_name: string;
  section: string;
  menu_id: number;
  menu_name: string;
  restaurant_id: number;
  restaurant_name: string;
  restaurant: DishDetailRestaurant;
}
