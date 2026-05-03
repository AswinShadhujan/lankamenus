import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional lat/lng/radius for GET /dishes/featured and GET /dishes/trending.
 * Same semantics as restaurant list nearby search.
 */
export class DishGeoQueryDto {
  /** Client cache-buster; ignored. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  _ts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lng?: string;

  /** Omitted with lat+lng → defaults to 12 km. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  radius_km?: string;

  /** Comma-separated restaurant district names (same as GET /restaurants). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  district?: string;

  /** Comma-separated cuisine/category tags to filter dishes by restaurant cuisine. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cuisine?: string;

  /**
   * Homepage dish-category pill: expands via `DISH_KEYWORDS` — name-only OR match (see lib/dishKeywords.ts).
   * Unknown labels fall back to a single search term equal to the raw `category` string.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  /**
   * Free text: menu item name substring or restaurant cuisine tag (ignored when `category` is set).
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Max rows to return from GET /dishes (default 20, max 50). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  limit?: string;

  /** SQL OFFSET (default 0, max 500). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  offset?: string;

  /** Result ordering: `default` | `popular` | `trending` | `distance` (unknown values → default). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sort?: string;
}
