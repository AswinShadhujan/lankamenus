import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetRestaurantImageUrlDto {
  @IsString()
  @MinLength(8, { message: 'Image URL is too short.' })
  @MaxLength(2048)
  imageUrl: string;
}
