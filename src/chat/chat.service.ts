import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatRoomType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateRoom(pharmacyId: string, type: ChatRoomType, productId?: string) {
    const existing = await this.prisma.chatRoom.findFirst({
      where: { pharmacyId, type, productId: productId ?? null },
    });
    if (existing) return existing;
    return this.prisma.chatRoom.create({
      data: { pharmacyId, type, productId: productId ?? null },
    });
  }

  async getRooms(pharmacyId: string) {
    return this.prisma.chatRoom.findMany({
      where: { pharmacyId },
      include: {
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(pharmacyId: string, type: ChatRoomType) {
    const room = await this.getOrCreateRoom(pharmacyId, type);
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { sentAt: 'asc' },
    });
    return { room, messages };
  }

  async sendMessage(pharmacyId: string, type: ChatRoomType, content: string) {
    const room = await this.getOrCreateRoom(pharmacyId, type);
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          roomId: room.id,
          senderId: pharmacyId,
          senderType: 'pharmacy',
          content,
        },
      }),
      this.prisma.chatRoom.update({
        where: { id: room.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return message;
  }

  async adminReply(roomId: string, adminId: string, content: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Phòng chat không tồn tại');
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { roomId, senderId: adminId, senderType: 'admin', content },
      }),
      this.prisma.chatRoom.update({
        where: { id: roomId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return message;
  }

  adminGetRooms() {
    return this.prisma.chatRoom.findMany({
      include: {
        pharmacy: { select: { name: true, code: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  adminGetMessages(roomId: string) {
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { sentAt: 'asc' },
    });
  }
}
