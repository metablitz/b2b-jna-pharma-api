import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivePharmacyGuard } from '../auth/guards/active-pharmacy.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, ActivePharmacyGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  categories() {
    return this.productsService.categories();
  }

  @Get('featured')
  findFeatured() {
    return this.productsService.findFeatured();
  }

  @Get('favorites')
  findFavorites(@CurrentUser() user: JwtPayload) {
    return this.productsService.findFavorites(user.sub);
  }

  @Get('favorite-ids')
  getFavoriteIds(@CurrentUser() user: JwtPayload) {
    return this.productsService.getFavoriteIds(user.sub);
  }

  @Get('recent')
  findRecentlyOrdered(@CurrentUser() user: JwtPayload) {
    return this.productsService.findRecentlyOrdered(user.sub);
  }

  @Get()
  findAll(@Query('search') search?: string, @Query('category') category?: string) {
    return this.productsService.findAll(search, category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post(':id/favorite')
  toggleFavorite(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.productsService.toggleFavorite(user.sub, id);
  }
}
