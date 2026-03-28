import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

/** Query parsers may yield a string[] when duplicate keys exist; take first non-empty. */
function firstQueryString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v = value.find((x) => x !== undefined && x !== null && String(x).trim() !== '');
    return v === undefined ? undefined : String(v).trim();
  }
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

export class SearchRestaurantsDto {
  /** Latitude for "near me" search (use with lng and radius_km). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lat?: string;

  /** Longitude for "near me" search (use with lat and radius_km). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lng?: string;

  /** Radius in km for "near me" search (use with lat and lng). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
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
  @Transform(({ value }) => firstQueryString(value))
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
