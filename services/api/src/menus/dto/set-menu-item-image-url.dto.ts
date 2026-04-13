import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetMenuItemImageUrlDto {
  @IsString()
  @MinLength(8, { message: 'Image URL is too short.' })
  @MaxLength(2048)
  imageUrl: string;
}
