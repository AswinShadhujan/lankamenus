import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/** Query parsers may yield a string[] when duplicate keys exist; take first non-empty. */
export function firstQueryString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v = value.find((x) => x !== undefined && x !== null && String(x).trim() !== '');
    return v === undefined ? undefined : String(v).trim();
  }
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/** Shared rules for GET /restaurants geo (bias vs strict). */
export function validateRestaurantSearchGeoFields(o: {
  lat?: string;
  lng?: string;
  radius_km?: string;
}):
  | { ok: true }
  | { ok: false; message: string } {
  const latP = firstQueryString(o.lat);
  const lngP = firstQueryString(o.lng);
  const radP = firstQueryString(o.radius_km);
  const hasLat = !!latP;
  const hasLng = !!lngP;
  const hasRadius = !!radP;
  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    return {
      ok: false,
      message: 'Both lat and lng are required for location search',
    };
  }
  if (hasRadius && (!hasLat || !hasLng)) {
    return {
      ok: false,
      message: 'lat and lng are required when radius_km is provided',
    };
  }
  return { ok: true };
}

@ValidatorConstraint({ name: 'restaurantSearchGeo', async: false })
export class RestaurantSearchGeoConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return validateRestaurantSearchGeoFields(
      args.object as { lat?: string; lng?: string; radius_km?: string },
    ).ok;
  }

  defaultMessage(args: ValidationArguments): string {
    const r = validateRestaurantSearchGeoFields(
      args.object as { lat?: string; lng?: string; radius_km?: string },
    );
    return r.ok ? 'Invalid geo parameters' : r.message;
  }
}

export class SearchRestaurantsDto {
  /** Client cache-buster; ignored (allowed so forbidNonWhitelisted does not 400). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  _ts?: string;

  /** Latitude for bias (with lng, no radius) or strict nearby (with lng + radius_km). */
  @IsOptional()
  @Transform(({ value }) => firstQueryString(value))
  @IsString()
  @MaxLength(40)
  @Validate(RestaurantSearchGeoConstraint)
  lat?: string;

  /** Longitude — pair with lat. */
  @IsOptional()
  @Transform(({ value }) => firstQueryString(value))
  @IsString()
  @MaxLength(40)
  @Validate(RestaurantSearchGeoConstraint)
  lng?: string;

  /** Radius in km — only with lat + lng for strict filtering. */
  @IsOptional()
  @Transform(({ value }) => firstQueryString(value))
  @IsString()
  @MaxLength(24)
  @Validate(RestaurantSearchGeoConstraint)
  radius_km?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** Single district or comma-separated list (multi-select). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  district?: string;

  /**
   * Dish-category pill: restrict to venues with ≥1 active menu item whose name matches any
   * `DISH_KEYWORDS` term (`services/api/src/lib/dishKeywords.ts`).
   * (Avoid `@Transform` here — must stay class-validator-whitelist-visible with forbidNonWhitelisted.)
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dish_category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cuisine?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  veg?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  halal?: string;

  @IsOptional()
  pricelevel?: string | string[];

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pagesize?: string;

  /**
   * Page size (preferred). Takes precedence over `pagesize` when both are sent.
   * Default 20, max 50 (enforced in service).
   */
  @IsOptional()
  @IsString()
  limit?: string;

  /**
   * Result ordering. Defaults: no sort + location → distance; no sort + no location → newest first;
   * text search + no sort → Meilisearch relevance (when configured).
   * `rating` is an alias for `top_rated`.
   */
  @IsOptional()
  @Transform(({ value }) => {
    const v = firstQueryString(value);
    if (v === 'topRated') return 'top_rated';
    return v;
  })
  @IsString()
  @IsIn([
    'relevance',
    'rating',
    'price',
    'distance',
    'top_rated',
    'popular',
    'trending',
  ])
  sort?:
    | 'relevance'
    | 'rating'
    | 'price'
    | 'distance'
    | 'top_rated'
    | 'popular'
    | 'trending';
}
