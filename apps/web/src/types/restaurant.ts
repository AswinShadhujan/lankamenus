export interface Restaurant {
  id: number;
  name_default: string;
  city?: string;
  district?: string;
  address_line1?: string;
  /** From API when stored (drives maps + distance features). */
  latitude?: number | null;
  longitude?: number | null;
  cuisine_tags: string[];
  price_level?: number;
  veg_friendly: boolean;
  halal_certified: boolean;
  created_at: string;
  /** Present when search used lat/lng/radius_km */
  distance_km?: number;
  /** From API when available */
  rating?: number | null;
  /** Review count (Google / simulated); drives popular ranking */
  rating_count?: number | null;
  view_count?: number | null;
  favorite_count?: number | null;
  photo_reference?: string | null;
  media_asset_id?: number | null;
  /** Primary cover when set (Cloudinary or external URL). */
  media_asset?: {
    id: number;
    source_type?: string;
    secure_url: string;
  } | null;
  /** Included by GET /restaurants/:id (findOne). */
  restaurant_extra_costs?: RestaurantExtraCost[];
}

export interface RestaurantExtraCost {
  id: number;
  label: string;
  /** Percentage as a string or number (Prisma Decimal). */
  rate: string | number;
  sort_order: number;
}

export interface District {
  id: string;
  name: string;
}

/** Pagination metadata from `GET /restaurants` (preferred). */
export interface RestaurantsListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Response shape for `GET /restaurants` (paginated list).
 * Legacy fields `page`, `pagesize`, `total` are preserved; `meta` adds normalized pagination.
 */
export interface RestaurantsListResponse {
  page: number;
  pagesize: number;
  total: number;
  data: Restaurant[];
  meta?: RestaurantsListMeta;
}
