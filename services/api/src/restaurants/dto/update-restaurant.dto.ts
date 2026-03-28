import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_default?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address_line1?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  cuisine_tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  price_level?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  veg_friendly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  halal_certified?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
