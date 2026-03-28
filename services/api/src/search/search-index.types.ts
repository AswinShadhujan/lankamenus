/** Document shape for the Meilisearch "restaurants" index. */
export interface RestaurantSearchDocument {
  id: number;
  name_default: string;
  city: string | null;
  district: string | null;
  cuisine_tags: string[];
  price_level: number | null;
  veg_friendly: boolean | null;
  halal_certified: boolean | null;
  menu_item_names: string[];
  menu_item_descriptions: string[];
}
