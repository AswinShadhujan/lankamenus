import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class ReorderBannersDto {
  /** Ordered list of banner IDs — position in array = sort_order. */
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids: number[];
}
