import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;
}
