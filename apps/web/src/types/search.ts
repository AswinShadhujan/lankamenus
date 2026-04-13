/** GET /search combined response */
export interface CombinedSearchRestaurant {
  id: number;
  name_default: string;
  city: string | null;
  district: string | null;
  photo_reference?: string | null;
  media_asset?: { secure_url: string; source_type?: string } | null;
  cuisine_tags?: string[];
}

export interface CombinedSearchDish {
  id: number;
  name: string;
  restaurant_id: number;
  restaurant_name: string;
  price: number | null;
  image: string | null;
  menu_id: number;
}

export interface CombinedSearchResponse {
  restaurants: CombinedSearchRestaurant[];
  dishes: CombinedSearchDish[];
}
