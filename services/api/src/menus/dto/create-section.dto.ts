import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSectionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;
}
