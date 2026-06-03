import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserStatusDto, AdminUsersListQueryDto } from './dto/admin-users.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUsersListQueryDto) {
    return this.adminUsers.list(query);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: AdminUserStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.adminUsers.setStatus(id, dto.isActive, user.sub, dto.reason);
  }
}
