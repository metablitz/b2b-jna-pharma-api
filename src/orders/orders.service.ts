import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `DH${y}${m}${d}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(pharmacyId: string, dto: CreateOrderDto) {
    const [cartItems, pharmacy, selectedAddress] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { pharmacyId },
        include: { product: true },
      }),
      this.prisma.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } }),
      dto.addressId
        ? this.prisma.address.findFirst({ where: { id: dto.addressId, pharmacyId } })
        : null,
    ]);

    if (cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng đang trống');
    }

    const discontinued = cartItems.filter((i) => !i.isFree && !i.product.isActive);
    if (discontinued.length > 0) {
      const names = discontinued.map((i) => i.product.name).join(', ');
      throw new BadRequestException(`Sản phẩm đã ngừng bán: ${names}`);
    }

    // stockQuantity=0 items are allowed as pre-orders; admin handles fulfillment separately

    const items = cartItems.map((item) => {
      const unitPrice = item.isFree ? 0 : item.addedPrice;
      return {
        productId: item.productId,
        productName: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const orderNumber = await this.generateOrderNumber();

    const [order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          orderNumber,
          pharmacyId,
          street: selectedAddress?.street ?? pharmacy.street,
          ward: selectedAddress?.ward ?? pharmacy.ward,
          district: selectedAddress?.district ?? pharmacy.district,
          province: selectedAddress?.province ?? pharmacy.province,
          note: dto.note,
          subtotal: total,
          total,
          items: { create: items },
        },
        include: { items: true },
      }),
      this.prisma.cartItem.deleteMany({ where: { pharmacyId } }),
    ]);

    return order;
  }

  findAll(pharmacyId: string, status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: { pharmacyId, ...(status ? { status } : {}) },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(pharmacyId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, pharmacyId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    return order;
  }

  async cancel(pharmacyId: string, id: string, reason?: string) {
    const order = await this.findOne(pharmacyId, id);

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new BadRequestException(
        `Không thể hủy đơn hàng đang ở trạng thái "${order.status}"`,
      );
    }

    const [cancelled] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason ?? 'Nhà thuốc yêu cầu hủy',
        },
        include: { items: true },
      }),
      ...order.items.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        }),
      ),
    ]);

    await this.notifications.create(
      pharmacyId,
      'order_cancelled',
      `Đơn hàng ${order.orderNumber} đã được hủy`,
      reason
        ? `Lý do: ${reason}`
        : 'Đơn hàng đã được hủy theo yêu cầu của nhà thuốc.',
      order.id,
    );

    return cancelled;
  }
}
