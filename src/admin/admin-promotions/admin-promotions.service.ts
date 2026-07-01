import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PromotionProductInput {
  productId: string;
  quantity: number;
  price: number;
  isFree: boolean;
}

export interface CreatePromotionDto {
  type: string;
  manufacturerName: string;
  title: string;
  totalSaving: number;
  minOrderQuantity?: number;
  startDate: string;
  endDate: string;
  buyProducts: PromotionProductInput[];
  giveProducts: PromotionProductInput[];
}

const WITH_PRODUCTS = {
  include: {
    buyProducts: { include: { product: { select: { name: true, unit: true } } } },
    giveProducts: { include: { product: { select: { name: true, unit: true } } } },
  },
};

@Injectable()
export class AdminPromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.promotion.findMany({ orderBy: { startDate: 'desc' }, ...WITH_PRODUCTS });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id }, ...WITH_PRODUCTS });
    if (!promo) throw new NotFoundException('Không tìm thấy khuyến mãi');
    return promo;
  }

  async create(dto: CreatePromotionDto) {
    const { buyProducts, giveProducts, startDate, endDate, ...data } = dto;
    const promo = await this.prisma.promotion.create({
      data: {
        ...data,
        type: data.type as any,
        minOrderQuantity: data.minOrderQuantity ?? 1,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
      },
    });
    await this.prisma.promotionProduct.createMany({
      data: [
        ...buyProducts.map((p) => ({ ...p, buyPromotionId: promo.id })),
        ...giveProducts.map((p) => ({ ...p, givePromotionId: promo.id })),
      ],
    });
    return this.findOne(promo.id);
  }

  async toggle(id: string) {
    const promo = await this.findOne(id);
    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: !promo.isActive },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.promotion.delete({ where: { id } });
    return { deleted: true };
  }
}
