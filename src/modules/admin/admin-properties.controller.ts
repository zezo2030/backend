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
  Query,
  UseGuards
} from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { PropertyUpdateDto } from '../properties/dto/property-write.dto.js';
import { AdminPropertiesService } from './admin-properties.service.js';
import {
  AdminPropertiesListQueryDto,
  AdminPropertyModerationDto,
  AdminPropertyStatusDto
} from './dto/admin-properties.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/properties', version: '1' })
export class AdminPropertiesController {
  constructor(private readonly adminProperties: AdminPropertiesService) {}

  @Get()
  list(@Query() query: AdminPropertiesListQueryDto) {
    return this.adminProperties.list(query);
  }

  @Post(':id/moderation')
  @HttpCode(HttpStatus.OK)
  moderate(
    @Param('id') id: string,
    @Body() dto: AdminPropertyModerationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminProperties.moderate(id, dto, user.sub);
  }

  @Patch(':id')
  updateDetails(
    @Param('id') id: string,
    @Body() dto: PropertyUpdateDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminProperties.updateDetails(id, dto, user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: AdminPropertyStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminProperties.updateStatus(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.adminProperties.softDelete(id, user.sub);
  }
}
