import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { BlockedIdentityService } from './blocked-identity.service.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/blocked-identities', version: '1' })
export class AdminBlocklistController {
  constructor(private readonly blocklist: BlockedIdentityService) {}

  @Get()
  list() {
    return this.blocklist.list();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(@Param('id') id: string): Promise<void> {
    await this.blocklist.unblock(id);
  }
}
