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
        id: true, code: true, name: true, ownerName: true, phone: true, email: true,
        street: true, province: true, memberTier: true, status: true,
        creditLimit: true, licenseSubmitMethod: true,
        businessLicenseName: true, pharmacyLicenseName: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      select: {
        id: true, code: true, name: true, ownerName: true, phone: true, email: true,
        street: true, province: true, memberTier: true, status: true,
        creditLimit: true, licenseSubmitMethod: true,
        businessLicenseName: true, pharmacyLicenseName: true,
        createdAt: true,
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

  async setCreditLimit(id: string, creditLimit: number) {
    await this.prisma.pharmacy.findUniqueOrThrow({ where: { id } });
    return this.prisma.pharmacy.update({
      where: { id },
      data: { creditLimit },
      select: { id: true, code: true, name: true, creditLimit: true },
    });
  }

  async getDocument(id: string, docType: 'business' | 'pharmacy') {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      select:
        docType === 'business'
          ? { businessLicenseFile: true, businessLicenseName: true }
          : { pharmacyLicenseFile: true, pharmacyLicenseName: true },
    });
    if (!pharmacy) throw new NotFoundException('Không tìm thấy nhà thuốc');

    const file =
      docType === 'business'
        ? (pharmacy as { businessLicenseFile: Buffer | null; businessLicenseName: string | null }).businessLicenseFile
        : (pharmacy as { pharmacyLicenseFile: Buffer | null; pharmacyLicenseName: string | null }).pharmacyLicenseFile;
    const name =
      docType === 'business'
        ? (pharmacy as { businessLicenseName: string | null }).businessLicenseName
        : (pharmacy as { pharmacyLicenseName: string | null }).pharmacyLicenseName;

    if (!file) throw new NotFoundException('Chưa có tài liệu');
    return { file, name: name ?? `${docType}-license` };
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
