import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ADMIN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ADMIN_EXPIRES_IN') as JwtSignOptions['expiresIn'],
    });

    const { passwordHash: _, ...safe } = admin;
    return { admin: safe, accessToken };
  }

  async findById(id: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new UnauthorizedException();
    const { passwordHash: _, ...safe } = admin;
    return safe;
  }
}
