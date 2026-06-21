import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMenuItemPortionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_available?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serves?: number | null;
}
