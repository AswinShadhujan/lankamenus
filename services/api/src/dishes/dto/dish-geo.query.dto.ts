import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional lat/lng/radius for GET /dishes/featured and GET /dishes/trending.
 * Same semantics as restaurant list nearby search.
 */
export class DishGeoQueryDto {
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
}
