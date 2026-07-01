import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from '../../chat/chat.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(AdminJwtGuard)
@Controller('admin/chat')
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  getRooms() {
    return this.chatService.adminGetRooms();
  }

  @Get('rooms/:roomId/messages')
  getMessages(@Param('roomId') roomId: string) {
    return this.chatService.adminGetMessages(roomId);
  }

  @Post('rooms/:roomId/messages')
  reply(
    @Param('roomId') roomId: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { content: string },
  ) {
    return this.chatService.adminReply(roomId, user.sub, body.content);
  }
}
