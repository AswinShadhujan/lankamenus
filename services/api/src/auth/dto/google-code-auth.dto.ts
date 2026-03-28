import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class GoogleCodeAuthDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  @MaxLength(2000)
  code: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'redirectUri is required' })
  @MaxLength(2000)
  redirectUri: string;
}
