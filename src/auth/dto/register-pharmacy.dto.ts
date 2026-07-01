import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterPharmacyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  businessLicense: string;

  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  ward: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  province: string;

  @Matches(/^(0|\+84)[0-9]{9,10}$/, {
    message: 'phone must be a valid Vietnamese phone number',
  })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
