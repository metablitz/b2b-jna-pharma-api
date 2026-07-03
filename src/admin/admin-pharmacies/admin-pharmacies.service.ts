import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { PharmacyStatus } from '@prisma/client';

@Injectable()
export class AdminPharmaciesService {
  constructor(private readonly prisma: PrismaService) {}

  pendingCount() {
    return this.prisma.pharmacy.count({ where: { status: 'pending' } });
  }

  findAll(status?: PharmacyStatus, search?: string) {
    return this.prisma.pharmacy.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true, code: true, name: true, phone: true, email: true,
        businessLicense: true, street: true, ward: true, district: true,
        province: true, memberTier: true, status: true, createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      select: {
        id: true, code: true, name: true, phone: true, email: true,
        businessLicense: true, street: true, ward: true, district: true,
        province: true, memberTier: true, status: true, createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
        },
      },
    });
    if (!pharmacy) throw new NotFoundException('Không tìm thấy nhà thuốc');
    return pharmacy;
  }

  async updateStatus(id: string, status: PharmacyStatus) {
    await this.findOne(id);
    return this.prisma.pharmacy.update({
      where: { id },
      data: { status },
      select: { id: true, code: true, name: true, status: true },
    });
  }

  async resetPassword(id: string) {
    await this.findOne(id);
    // Generate temp password: JNA- + 6 random digits
    const plain = `JNA-${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await bcrypt.hash(plain, 10);
    await this.prisma.pharmacy.update({ where: { id }, data: { passwordHash } });
    return { tempPassword: plain };
  }
}
