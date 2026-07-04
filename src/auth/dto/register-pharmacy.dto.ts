import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterPharmacyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsNotEmpty()
  street: string; // single-line address

  @IsString()
  @IsOptional()
  province?: string;

  @Matches(/^(0|\+84)[0-9]{8,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsOptional()
  licenseSubmitMethod?: string; // "uploaded" | "via_zalo"
}
