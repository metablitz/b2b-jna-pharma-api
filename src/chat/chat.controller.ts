import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { ChatRoomType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  getRooms(@CurrentUser() user: JwtPayload) {
    return this.chatService.getRooms(user.sub);
  }

  @Get('rooms/:type/messages')
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: ChatRoomType,
  ) {
    return this.chatService.getMessages(user.sub, type);
  }

  @Post('rooms/:type/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: ChatRoomType,
    @Body() body: { content: string },
  ) {
    return this.chatService.sendMessage(user.sub, type, body.content);
  }
}
