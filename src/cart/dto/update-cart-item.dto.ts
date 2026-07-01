import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  quantity: number;

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
}
