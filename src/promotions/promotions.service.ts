import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const WITH_PRODUCTS = {
  include: {
    buyProducts: { include: { product: true } },
    giveProducts: { include: { product: true } },
  },
};

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.promotion.findMany({
      where: { isActive: true, NOT: { type: 'flash_sale' } },
      orderBy: { startDate: 'desc' },
      ...WITH_PRODUCTS,
    });
  }

  findFlashSales() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        type: 'flash_sale',
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { endDate: 'asc' },
      ...WITH_PRODUCTS,
    });
  }

  async findOne(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      ...WITH_PRODUCTS,
    });
    if (!promotion) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    return promotion;
  }
}
