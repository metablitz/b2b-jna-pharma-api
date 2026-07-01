import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { AdminChatController } from './admin-chat/admin-chat.controller';

import { AdminAuthController } from './admin-auth/admin-auth.controller';
import { AdminAuthService } from './admin-auth/admin-auth.service';
import { AdminJwtStrategy } from './admin-auth/admin-jwt.strategy';

import { AdminProductsController } from './admin-products/admin-products.controller';
import { AdminProductsService } from './admin-products/admin-products.service';

import { AdminOrdersController } from './admin-orders/admin-orders.controller';
import { AdminOrdersService } from './admin-orders/admin-orders.service';

import { AdminPromotionsController } from './admin-promotions/admin-promotions.controller';
import { AdminPromotionsService } from './admin-promotions/admin-promotions.service';
import { AdminPharmaciesController } from './admin-pharmacies/admin-pharmacies.controller';
import { AdminPharmaciesService } from './admin-pharmacies/admin-pharmacies.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), NotificationsModule, ChatModule],
  controllers: [
    AdminAuthController,
    AdminProductsController,
    AdminOrdersController,
    AdminPromotionsController,
    AdminPharmaciesController,
    AdminChatController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminProductsService,
    AdminOrdersService,
    AdminPromotionsService,
    AdminPharmaciesService,
  ],
})
export class AdminModule {}
