import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Post, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { RegisterPharmacyDto } from './dto/register-pharmacy.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './types/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'businessLicenseFile', maxCount: 1 },
    { name: 'pharmacyLicenseFile', maxCount: 1 },
  ], { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB max
  register(
    @Body() dto: RegisterPharmacyDto,
    @UploadedFiles() files: {
      businessLicenseFile?: Express.Multer.File[];
      pharmacyLicenseFile?: Express.Multer.File[];
    },
  ) {
    return this.authService.register(dto, {
      businessLicenseFile: files?.businessLicenseFile?.[0],
      pharmacyLicenseFile: files?.pharmacyLicenseFile?.[0],
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
