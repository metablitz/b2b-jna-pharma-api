import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OrderStatus } from '@prisma/client';

const STATUS_TITLE: Record<string, string> = {
  confirmed: 'Đơn hàng đã xác nhận',
  shipping: 'Đơn hàng đang giao',
  delivered: 'Đơn hàng đã giao thành công',
};

const STATUS_NOTIF_TYPE: Record<string, 'order_confirmed' | 'order_shipping' | 'order_delivered'> = {
  confirmed: 'order_confirmed',
  shipping: 'order_shipping',
  delivered: 'order_delivered',
};

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'shipping',
  shipping: 'delivered',
  delivered: null,
  cancelled: null,
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(status?: OrderStatus, search?: string) {
    return this.prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? { orderNumber: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      include: { pharmacy: { select: { name: true, code: true, phone: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { pharmacy: { select: { name: true, code: true, phone: true } }, items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async advanceStatus(id: string) {
    const order = await this.findOne(id);
    const next = STATUS_FLOW[order.status];
    if (!next) throw new BadRequestException(`Không thể chuyển trạng thái từ ${order.status}`);

    const now = new Date();
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: next,
        ...(next === 'confirmed' ? { confirmedAt: now } : {}),
        ...(next === 'shipping' ? { shippedAt: now } : {}),
        ...(next === 'delivered' ? { deliveredAt: now } : {}),
      },
      include: { items: true },
    });

    const notifType = STATUS_NOTIF_TYPE[next];
    if (notifType) {
      await this.notifications.create(
        order.pharmacyId,
        notifType,
        `${STATUS_TITLE[next]} - ${order.orderNumber}`,
        `Đơn hàng ${order.orderNumber} đã được cập nhật.`,
        order.id,
      );
    }
    return updated;
  }

  async cancel(id: string, reason?: string) {
    const order = await this.findOne(id);
    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new BadRequestException('Không thể hủy đơn hàng ở trạng thái này');
    }
    const [cancelled] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason },
        include: { items: true },
      }),
      ...order.items.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        }),
      ),
    ]);
    return cancelled;
  }
}
