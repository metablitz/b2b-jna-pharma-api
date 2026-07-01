import { IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  addressId?: string;
}
