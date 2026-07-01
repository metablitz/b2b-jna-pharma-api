import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import type { AddressDto } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put()
  update(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { name?: string; email?: string },
  ) {
    return this.profileService.update(user.sub, dto);
  }

  @Put('password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.profileService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  // ── Addresses ──────────────────────────────────────────────────────────────

  @Get('addresses')
  listAddresses(@CurrentUser() user: JwtPayload) {
    return this.profileService.listAddresses(user.sub);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: JwtPayload, @Body() dto: AddressDto) {
    return this.profileService.createAddress(user.sub, dto);
  }

  @Put('addresses/:id')
  updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddressDto,
  ) {
    return this.profileService.updateAddress(user.sub, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.profileService.deleteAddress(user.sub, id);
  }

  @Put('addresses/:id/default')
  setDefault(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.profileService.setDefault(user.sub, id);
  }
}
