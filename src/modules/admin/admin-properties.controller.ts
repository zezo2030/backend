import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { AdminPropertiesService } from './admin-properties.service.js';
import {
  AdminPropertiesListQueryDto,
  AdminPropertyModerationDto
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
}
