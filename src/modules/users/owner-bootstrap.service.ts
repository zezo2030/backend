import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../common/enums/role.enum.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/**
 * Enforces the single locked owner / super-admin account designated by the
 * OWNER_EMAIL env var. On boot the matching user is force-promoted to
 * isOwner + Admin, and any other user erroneously flagged isOwner is demoted —
 * guaranteeing exactly one owner. Edits to this account by other admins are
 * blocked in AdminUsersService.
 */
@Injectable()
export class OwnerBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(OwnerBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    const ownerEmail = (this.config.get<string>('ownerEmail') ?? '').trim().toLowerCase();
    if (!ownerEmail) {
      this.logger.warn('OWNER_EMAIL is not set; no owner account is enforced.');
      return;
    }

    try {
      const owner = await this.prisma.user.findFirst({
        where: { email: ownerEmail, deletedAt: null },
        select: { id: true }
      });

      // Demote any stale owner flags that don't belong to the configured email.
      await this.prisma.user.updateMany({
        where: { isOwner: true, ...(owner ? { id: { not: owner.id } } : {}) },
        data: { isOwner: false }
      });

      if (!owner) {
        this.logger.warn(
          `OWNER_EMAIL=${ownerEmail} has no matching account yet; it will be promoted once that user registers.`
        );
        return;
      }

      await this.prisma.user.update({
        where: { id: owner.id },
        data: { isOwner: true, role: Role.Admin, isActive: true }
      });
      this.logger.log(`Owner account enforced for ${ownerEmail}.`);
    } catch (error) {
      // Never block app startup on this best-effort reconciliation.
      this.logger.error(`Owner bootstrap failed: ${(error as Error).message}`);
    }
  }
}
