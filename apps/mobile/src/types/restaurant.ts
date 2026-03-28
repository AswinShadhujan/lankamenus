export interface Restaurant {
  id: number;
  name_default: string;
  city?: string;
  district?: string;
  address_line1?: string;
  cuisine_tags: string[];
  price_level?: number;
  veg_friendly: boolean;
  halal_certified: boolean;
  created_at: string;
  /** Present when search used lat/lng/radius_km */
  distance_km?: number;
}

export interface District {
  id: string;
  name: string;
}
