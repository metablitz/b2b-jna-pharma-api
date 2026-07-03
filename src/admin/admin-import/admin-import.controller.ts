import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ExecuteChoices } from './admin-import.service';
import { AdminImportService } from './admin-import.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/import')
export class AdminImportController {
  constructor(private readonly service: AdminImportService) {}

  @Post('products/preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('File is required');
    return this.service.preview(file.buffer, file.originalname);
  }

  @Post('products/execute')
  @UseInterceptors(FileInterceptor('file'))
  execute(
    @UploadedFile() file: Express.Multer.File,
    @Body('choices') choicesJson: string,
  ) {
    if (!file) throw new Error('File is required');
    const choices: ExecuteChoices = JSON.parse(choicesJson || '{"categoryMappings":[],"missingActions":[]}');
    return this.service.execute(file.buffer, file.originalname, choices);
  }

  @Get('category-mappings')
  getMappings() {
    return this.service.getMappings();
  }

  @Put('category-mappings')
  saveMappings(@Body() body: { mappings: { rawName: string; displayName: string }[] }) {
    return this.service.saveMappings(body.mappings || []);
  }

  @Get('logs')
  getLogs() {
    return this.service.getLogs();
  }
}
