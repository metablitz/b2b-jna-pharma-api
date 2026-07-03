import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivePharmacyGuard } from '../auth/guards/active-pharmacy.guard';

@UseGuards(JwtAuthGuard, ActivePharmacyGuard)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('flash-sale')
  findFlashSales() {
    return this.promotionsService.findFlashSales();
  }

  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(id);
  }
}
