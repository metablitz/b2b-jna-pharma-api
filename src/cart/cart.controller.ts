import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivePharmacyGuard } from '../auth/guards/active-pharmacy.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, ActivePharmacyGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.cartService.findAll(user.sub);
  }

  @Post('items')
  addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Put('items/:productId')
  updateQuantity(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateQuantity(user.sub, productId, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Query('isFree') isFree?: string,
  ) {
    return this.cartService.removeItem(user.sub, productId, isFree === 'true');
  }

  @Post('flash-sale/:promotionId')
  addFromFlashSale(
    @CurrentUser() user: JwtPayload,
    @Param('promotionId') promotionId: string,
    @Query('quantity', new ParseIntPipe({ optional: true })) quantity = 1,
  ) {
    return this.cartService.addFromFlashSale(user.sub, promotionId, quantity);
  }

  @Post('promotions/:promotionId')
  addFromPromotion(
    @CurrentUser() user: JwtPayload,
    @Param('promotionId') promotionId: string,
    @Query('comboQty', new ParseIntPipe({ optional: true })) comboQty = 1,
  ) {
    return this.cartService.addFromPromotion(user.sub, promotionId, comboQty);
  }

  @Delete()
  clear(@CurrentUser() user: JwtPayload) {
    return this.cartService.clear(user.sub);
  }
}
