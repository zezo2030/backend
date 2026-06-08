import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { BannersService } from './banners.service.js';
import { CreateBannerDto, ReorderBannersDto, UpdateBannerDto } from './dto/banner.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/banners', version: '1' })
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  list() {
    return this.banners.listAdmin();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderBannersDto) {
    return this.banners.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.banners.remove(id);
  }
}
