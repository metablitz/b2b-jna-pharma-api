import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
}
