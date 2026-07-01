import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { OrderStatus } from '@prisma/client';

@UseGuards(AdminJwtGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly service: AdminOrdersService) {}

  @Get()
  findAll(@Query('status') status?: OrderStatus, @Query('search') search?: string) {
    return this.service.findAll(status, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id/advance')
  advanceStatus(@Param('id') id: string) {
    return this.service.advanceStatus(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.service.cancel(id, body?.reason);
  }
}
