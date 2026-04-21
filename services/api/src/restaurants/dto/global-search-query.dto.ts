import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GlobalSearchQueryDto {
  /** Client cache-buster; ignored. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  _ts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** When set, only that result set is queried (faster). Omit for both. */
  @IsOptional()
  @IsIn(['dishes', 'restaurants'])
  scope?: 'dishes' | 'restaurants';
}
