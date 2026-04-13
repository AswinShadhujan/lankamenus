import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BANNER_CTA_TYPES } from './banner-cta-type';

/**
 * Explicit fields (not PartialType) so class-validator whitelist metadata is always
 * registered on this class — avoids rare cases where inherited metadata is missing at runtime.
 */
export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cta_url?: string;

  @IsOptional()
  @IsString()
  @IsIn([...BANNER_CTA_TYPES])
  cta_type?: (typeof BANNER_CTA_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  restaurant_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cuisine_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  overlay_color?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;
}
