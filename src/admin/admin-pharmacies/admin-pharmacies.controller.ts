import {
  Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminPharmaciesService } from './admin-pharmacies.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { PharmacyStatus } from '@prisma/client';

@UseGuards(AdminJwtGuard)
@Controller('admin/pharmacies')
export class AdminPharmaciesController {
  constructor(private readonly service: AdminPharmaciesService) {}

  @Get('pending-count')
  pendingCount() {
    return this.service.pendingCount().then((count) => ({ count }));
  }

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

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.service.resetPassword(id);
  }

  @Put(':id/credit-limit')
  setCreditLimit(@Param('id') id: string, @Body() body: { creditLimit: number }) {
    return this.service.setCreditLimit(id, body.creditLimit);
  }

  @Get(':id/documents/:docType')
  async downloadDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Res() res: Response,
  ) {
    const type = docType === 'business' ? 'business' : 'pharmacy';
    const { file, name } = await this.service.getDocument(id, type);
    const ext = name.split('.').pop() ?? 'bin';
    res.set({
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Type': ext === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    });
    res.send(file);
  }
}
