import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class ActivePharmacyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user?.sub) return false;

    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id: user.sub },
      select: { status: true },
    });

    if (!pharmacy) return false;

    if (pharmacy.status === 'pending') {
      throw new ForbiddenException('PENDING');
    }

    if (pharmacy.status === 'suspended') {
      throw new ForbiddenException('SUSPENDED');
    }

    return pharmacy.status === 'active';
  }
}
