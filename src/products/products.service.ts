import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private productInclude = { include: { tierPricing: true } };

  findAll(search?: string, category?: string) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { manufacturer: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...this.productInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const now = new Date();
    const [product, promotions] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id },
        ...this.productInclude,
      }),
      this.prisma.promotion.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          buyProducts: { some: { productId: id } },
        },
        include: {
          buyProducts: { include: { product: { select: { name: true, unit: true } } } },
          giveProducts: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),
    ]);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return { ...product, promotions };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  findFeatured() {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      ...this.productInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findFavorites(pharmacyId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: { pharmacyId },
      include: { product: { include: { tierPricing: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map((f) => f.product);
  }

  async findRecentlyOrdered(pharmacyId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { pharmacyId } },
      select: { productId: true },
      distinct: ['productId'],
      orderBy: { order: { createdAt: 'desc' } },
      take: 20,
    });
    if (items.length === 0) return [];
    const productIds = items.map((i) => i.productId);
    return this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      ...this.productInclude,
    });
  }

  async getFavoriteIds(pharmacyId: string): Promise<string[]> {
    const favs = await this.prisma.favorite.findMany({
      where: { pharmacyId },
      select: { productId: true },
    });
    return favs.map((f) => f.productId);
  }

  async toggleFavorite(pharmacyId: string, productId: string) {
    await this.findOne(productId);
    const existing = await this.prisma.favorite.findUnique({
      where: { pharmacyId_productId: { pharmacyId, productId } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.favorite.create({ data: { pharmacyId, productId } });
    return { favorited: true };
  }
}
