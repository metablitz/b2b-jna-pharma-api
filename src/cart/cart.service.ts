import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(pharmacyId: string) {
    return this.prisma.cartItem.findMany({
      where: { pharmacyId },
      include: { product: { include: { tierPricing: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async addItemWithPrice(
    pharmacyId: string,
    productId: string,
    quantity: number,
    addedPrice: number,
    isFree: boolean,
  ) {
    const existing = await this.prisma.cartItem.findUnique({
      where: { pharmacyId_productId_isFree: { pharmacyId, productId, isFree } },
    });
    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { product: true },
      });
    }
    return this.prisma.cartItem.create({
      data: { pharmacyId, productId, quantity, addedPrice, isFree },
      include: { product: true },
    });
  }

  async addItem(pharmacyId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    const isFree = dto.isFree ?? false;
    const price = isFree ? 0 : product.currentPrice;
    return this.addItemWithPrice(pharmacyId, dto.productId, dto.quantity, price, isFree);
  }

  async addFromFlashSale(pharmacyId: string, promotionId: string, quantity: number) {
    const now = new Date();
    const promo = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      include: { buyProducts: true },
    });
    if (
      !promo ||
      promo.type !== 'flash_sale' ||
      !promo.isActive ||
      promo.startDate > now ||
      promo.endDate < now
    ) {
      throw new BadRequestException('Flash sale không tồn tại hoặc đã hết hạn');
    }
    const flashProduct = promo.buyProducts[0];
    if (!flashProduct) throw new BadRequestException('Flash sale không có sản phẩm');

    return this.addItemWithPrice(
      pharmacyId,
      flashProduct.productId,
      quantity,
      flashProduct.price,
      false,
    );
  }

  async addFromPromotion(pharmacyId: string, promotionId: string, comboQty: number) {
    const now = new Date();
    const promo = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        buyProducts: { include: { product: true } },
        giveProducts: { include: { product: true } },
      },
    });
    if (
      !promo ||
      promo.type === 'flash_sale' ||
      !promo.isActive ||
      promo.startDate > now ||
      promo.endDate < now
    ) {
      throw new BadRequestException('Chương trình khuyến mãi không tồn tại hoặc đã kết thúc');
    }
    if (comboQty < (promo.minOrderQuantity ?? 1)) {
      throw new BadRequestException(
        `Số lượng combo tối thiểu là ${promo.minOrderQuantity}`,
      );
    }

    const results = await Promise.all([
      ...promo.buyProducts.map((bp) =>
        this.addItemWithPrice(pharmacyId, bp.productId, bp.quantity * comboQty, bp.price, false),
      ),
      ...promo.giveProducts.map((gp) =>
        this.addItemWithPrice(pharmacyId, gp.productId, gp.quantity * comboQty, 0, true),
      ),
    ]);
    return { added: results.length };
  }

  async updateQuantity(pharmacyId: string, productId: string, dto: UpdateCartItemDto) {
    const isFree = dto.isFree ?? false;
    const where = {
      pharmacyId_productId_isFree: { pharmacyId, productId, isFree },
    };
    const existing = await this.prisma.cartItem.findUnique({ where });
    if (!existing) throw new NotFoundException('Sản phẩm không có trong giỏ hàng');

    if (dto.quantity === 0) {
      await this.prisma.cartItem.delete({ where });
      return { removed: true };
    }
    return this.prisma.cartItem.update({
      where,
      data: { quantity: dto.quantity },
      include: { product: true },
    });
  }

  async removeItem(pharmacyId: string, productId: string, isFree: boolean) {
    await this.prisma.cartItem.deleteMany({ where: { pharmacyId, productId, isFree } });
    return { removed: true };
  }

  async clear(pharmacyId: string) {
    await this.prisma.cartItem.deleteMany({ where: { pharmacyId } });
    return { cleared: true };
  }
}
