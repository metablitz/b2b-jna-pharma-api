import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(pharmacyId: string, type: NotificationType, title: string, body: string, orderId?: string) {
    return this.prisma.notification.create({
      data: { pharmacyId, type, title, body, orderId },
    });
  }

  findAll(pharmacyId: string) {
    return this.prisma.notification.findMany({
      where: { pharmacyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, pharmacyId: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  unreadCount(pharmacyId: string) {
    return this.prisma.notification.count({
      where: { pharmacyId, isRead: false },
    });
  }
}
