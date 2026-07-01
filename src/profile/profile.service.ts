import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressDto {
  label?: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  phone?: string;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async update(pharmacyId: string, dto: { name?: string; email?: string }) {
    const pharmacy = await this.prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: dto,
    });
    const { passwordHash: _, ...safe } = pharmacy;
    return safe;
  }

  async changePassword(
    pharmacyId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    const pharmacy = await this.prisma.pharmacy.findUniqueOrThrow({
      where: { id: pharmacyId },
    });
    const matches = await bcrypt.compare(currentPassword, pharmacy.passwordHash);
    if (!matches) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    await this.prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { success: true };
  }

  // ── Addresses ──────────────────────────────────────────────────────────────

  listAddresses(pharmacyId: string) {
    return this.prisma.address.findMany({
      where: { pharmacyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(pharmacyId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { pharmacyId } });
    return this.prisma.address.create({
      data: {
        pharmacyId,
        label: dto.label ?? 'Nhà thuốc',
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        province: dto.province,
        phone: dto.phone,
        isDefault: count === 0, // first address becomes default
      },
    });
  }

  async updateAddress(pharmacyId: string, id: string, dto: AddressDto) {
    await this.guardOwnership(pharmacyId, id);
    return this.prisma.address.update({
      where: { id },
      data: {
        label: dto.label,
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        province: dto.province,
        phone: dto.phone ?? null,
      },
    });
  }

  async deleteAddress(pharmacyId: string, id: string) {
    const addr = await this.guardOwnership(pharmacyId, id);
    await this.prisma.address.delete({ where: { id } });

    // if deleted was default, promote the first remaining address
    if (addr.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { pharmacyId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  }

  async setDefault(pharmacyId: string, id: string) {
    await this.guardOwnership(pharmacyId, id);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { pharmacyId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.listAddresses(pharmacyId);
  }

  private async guardOwnership(pharmacyId: string, id: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, pharmacyId } });
    if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ');
    return addr;
  }
}
