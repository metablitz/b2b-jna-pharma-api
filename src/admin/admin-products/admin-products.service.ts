import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertProductDto {
  name: string;
  sku: string;
  category: string;
  manufacturer: string;
  unit: string;
  packagingInfo: string;
  basePrice: number;
  currentPrice: number;
  previousPrice?: number;
  priceChangePercent?: number;
  isVAT: boolean;
  stockQuantity: number;
  isLimitedStock: boolean;
  isFeatured: boolean;
  isActive: boolean;
  expiryDate?: string | null;
  tierPricing: { minQuantity: number; price: number }[];
}

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.product.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: { tierPricing: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { tierPricing: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product;
  }

  async create(dto: UpsertProductDto) {
    const { tierPricing, expiryDate, ...data } = dto;
    const product = await this.prisma.product.create({
      data: {
        ...data,
        images: [],
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });
    if (tierPricing.length > 0) {
      await this.prisma.tierPrice.createMany({
        data: tierPricing.map((t) => ({ ...t, productId: product.id })),
      });
    }
    return this.findOne(product.id);
  }

  async update(id: string, dto: UpsertProductDto) {
    await this.findOne(id);
    const { tierPricing, expiryDate, ...data } = dto;
    await this.prisma.product.update({
      where: { id },
      data: { ...data, expiryDate: expiryDate ? new Date(expiryDate) : null },
    });
    await this.prisma.tierPrice.deleteMany({ where: { productId: id } });
    if (tierPricing.length > 0) {
      await this.prisma.tierPrice.createMany({
        data: tierPricing.map((t) => ({ ...t, productId: id })),
      });
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
