import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { StatsService } from './stats.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/moderation', version: '1' })
export class AdminModerationController {
  constructor(private readonly stats: StatsService) {}

  @Get('pending-count')
  pendingCount() {
    return this.stats.getPendingCount();
  }
}
