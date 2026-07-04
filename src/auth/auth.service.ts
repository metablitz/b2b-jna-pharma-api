import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPharmacyDto } from './dto/register-pharmacy.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.interface';
import type { Pharmacy } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private sanitize(pharmacy: Pharmacy) {
    const { passwordHash: _passwordHash, ...safe } = pharmacy;
    return safe;
  }

  private async generatePharmacyCode(): Promise<string> {
    const count = await this.prisma.pharmacy.count();
    return `JNA${String(count + 1).padStart(6, '0')}`;
  }

  private async issueTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async register(
    dto: RegisterPharmacyDto,
    files?: {
      businessLicenseFile?: Express.Multer.File;
      pharmacyLicenseFile?: Express.Multer.File;
    },
  ) {
    const existing = await this.prisma.pharmacy.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Số điện thoại đã được đăng ký');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const code = await this.generatePharmacyCode();

    const pharmacy = await this.prisma.pharmacy.create({
      data: {
        code,
        name: dto.name,
        ownerName: dto.ownerName,
        street: dto.street,
        province: dto.province ?? '',
        ward: '',
        district: '',
        phone: dto.phone,
        passwordHash,
        licenseSubmitMethod: dto.licenseSubmitMethod ?? null,
        businessLicenseFile: files?.businessLicenseFile?.buffer ?? null,
        businessLicenseName: files?.businessLicenseFile?.originalname ?? null,
        pharmacyLicenseFile: files?.pharmacyLicenseFile?.buffer ?? null,
        pharmacyLicenseName: files?.pharmacyLicenseFile?.originalname ?? null,
      },
    });

    const tokens = await this.issueTokens({ sub: pharmacy.id, phone: pharmacy.phone });
    return { pharmacy: this.sanitize(pharmacy), ...tokens };
  }

  async login(dto: LoginDto) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { phone: dto.phone },
    });
    if (!pharmacy) {
      throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng');
    }

    const passwordMatches = await bcrypt.compare(dto.password, pharmacy.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng');
    }

    const tokens = await this.issueTokens({ sub: pharmacy.id, phone: pharmacy.phone });
    return { pharmacy: this.sanitize(pharmacy), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id: payload.sub },
    });
    if (!pharmacy) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    return this.issueTokens({ sub: pharmacy.id, phone: pharmacy.phone });
  }

  async me(pharmacyId: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
    });
    if (!pharmacy) {
      throw new UnauthorizedException();
    }
    return this.sanitize(pharmacy);
  }
}
