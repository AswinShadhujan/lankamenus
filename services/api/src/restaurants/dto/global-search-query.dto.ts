import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
