import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AccountActiveGuard } from '../../common/auth/account-active.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { BroadcastService } from './broadcast.service.js';
import { AdminBroadcastDto } from './dto/admin-broadcast.dto.js';

@UseGuards(JwtAuthGuard, AccountActiveGuard, RolesGuard)
@Roles(Role.Admin)
@Controller({ path: 'admin/notifications', version: '1' })
export class AdminBroadcastController {
  constructor(
    private readonly broadcast: BroadcastService,
    private readonly auditLogger: AuditLogger
  ) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@Body() dto: AdminBroadcastDto, @CurrentUser() user: AuthenticatedUser) {
    const enqueued = await this.broadcast.enqueue(dto, user.sub);
    await this.auditLogger.log({
      actorUserId: user.sub,
      action: 'admin.broadcast_enqueued',
      targetType: 'broadcast',
      metadata: { audience: dto.audience, broadcastId: enqueued.id }
    });
    return enqueued;
  }
}
