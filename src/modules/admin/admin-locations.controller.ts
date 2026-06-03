import {
  Body,
  Controller,
  Delete,
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
import { AdminLocationsService } from './admin-locations.service.js';
import { CreateAreaDto, CreateCityDto, UpdateLocationDto } from './dto/admin-locations.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/locations', version: '1' })
export class AdminLocationsController {
  constructor(private readonly adminLocations: AdminLocationsService) {}

  @Post('cities')
  @HttpCode(HttpStatus.CREATED)
  createCity(@Body() dto: CreateCityDto) {
    return this.adminLocations.createCity(dto);
  }

  @Post('areas')
  @HttpCode(HttpStatus.CREATED)
  createArea(@Body() dto: CreateAreaDto) {
    return this.adminLocations.createArea(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.adminLocations.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.adminLocations.remove(id);
  }
}
