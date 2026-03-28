/** Shared item from GET /dishes/featured and GET /dishes/trending */
export type DishDiscoveryItem = {
  id: number;
  name: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  is_popular: boolean;
  is_recommended: boolean;
  click_count: number;
  menu_id: number;
  restaurant: {
    id: number;
    name: string;
    rating: number | null;
  };
};

/** @deprecated Use DishDiscoveryItem */
export type FeaturedDish = DishDiscoveryItem;
