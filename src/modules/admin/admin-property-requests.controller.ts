import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { AdminPropertyRequestsService } from './admin-property-requests.service.js';
import { AdminPropertyRequestsListQueryDto } from './dto/admin-property-requests.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/property-requests', version: '1' })
export class AdminPropertyRequestsController {
  constructor(private readonly adminRequests: AdminPropertyRequestsService) {}

  @Get()
  list(@Query() query: AdminPropertyRequestsListQueryDto) {
    return this.adminRequests.list(query);
  }
}
