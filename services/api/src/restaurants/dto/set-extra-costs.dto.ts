import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExtraCostItemDto {
  @IsString()
  @MaxLength(100)
  label: string;

  /** Percentage rate, e.g. 10 for 10%. Supports up to 3 decimal places. */
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  rate: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  sort_order?: number;
}

export class SetExtraCostsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraCostItemDto)
  @ArrayMaxSize(20)
  costs: ExtraCostItemDto[];
}
