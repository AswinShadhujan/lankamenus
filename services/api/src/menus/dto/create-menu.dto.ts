import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMenuDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;
}
