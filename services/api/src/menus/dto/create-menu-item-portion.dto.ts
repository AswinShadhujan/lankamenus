import { IsString, IsOptional, IsInt, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMenuItemPortionDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serves?: number;
}
