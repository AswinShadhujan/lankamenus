import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  menu_section_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  veg?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_available?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_popular?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_recommended?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  ingredients?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rating_count?: number;

  /** Set to null to clear the image. */
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @IsString()
  @IsUrl({ protocols: ['http', 'https'] })
  @MaxLength(2000)
  image_url?: string | null;
}
