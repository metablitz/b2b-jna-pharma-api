import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { AdminPharmaciesService } from './admin-pharmacies.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { PharmacyStatus } from '@prisma/client';

@UseGuards(AdminJwtGuard)
@Controller('admin/pharmacies')
export class AdminPharmaciesController {
  constructor(private readonly service: AdminPharmaciesService) {}

  @Get()
  findAll(@Query('status') status?: PharmacyStatus, @Query('search') search?: string) {
    return this.service.findAll(status, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: PharmacyStatus }) {
    return this.service.updateStatus(id, body.status);
  }
}
