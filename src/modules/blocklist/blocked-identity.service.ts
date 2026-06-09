import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface BlockedIdentityDto {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export const normalizeEmail = (email?: string | null): string | null =>
  email ? email.trim().toLowerCase() || null : null;

export const normalizePhone = (phone?: string | null): string | null =>
  phone ? phone.trim() || null : null;

@Injectable()
export class BlockedIdentityService implements OnModuleInit {
  private readonly logger = new Logger(BlockedIdentityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const added = await this.reconcileFromDeletedUsers();
      if (added > 0) {
        this.logger.log(`Backfilled ${added} blocked identity row(s) from deleted accounts.`);
      }
    } catch (error) {
      // Best-effort reconciliation — never block API startup.
      this.logger.error(`Blocked-identity reconciliation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Ensures every soft-deleted user has matching blocked_identity rows. Covers
   * accounts deleted before the blocklist feature shipped or before redeploy.
   */
  async reconcileFromDeletedUsers(): Promise<number> {
    const deleted = await this.prisma.user.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, email: true, phone: true }
    });
    const data: Prisma.BlockedIdentityCreateManyInput[] = [];
    for (const user of deleted) {
      const email = normalizeEmail(user.email);
      const phone = normalizePhone(user.phone);
      if (email) {
        data.push({ email, reason: 'account_deleted', createdBy: user.id });
      }
      if (phone) {
        data.push({ phone, reason: 'account_deleted', createdBy: user.id });
      }
    }
    if (data.length === 0) return 0;
    const result = await this.prisma.blockedIdentity.createMany({
      data,
      skipDuplicates: true
    });
    return result.count;
  }

  /**
   * Build the create rows for blocking a deleted account's identity. Email and
   * phone are stored as separate rows so a unique conflict on one never blocks
   * the other. Returns a ready-to-await Prisma op for inclusion in an existing
   * `$transaction([...])` (e.g. account deletion).
   */
  buildBlockOp(params: {
    email?: string | null;
    phone?: string | null;
    reason?: string;
    createdBy?: string;
  }): Prisma.PrismaPromise<Prisma.BatchPayload> {
    const email = normalizeEmail(params.email);
    const phone = normalizePhone(params.phone);
    const data: Prisma.BlockedIdentityCreateManyInput[] = [];
    if (email) data.push({ email, reason: params.reason, createdBy: params.createdBy });
    if (phone) data.push({ phone, reason: params.reason, createdBy: params.createdBy });
    return this.prisma.blockedIdentity.createMany({ data, skipDuplicates: true });
  }

  /** Throws ConflictException if the email or phone is blocked from re-registration. */
  async assertNotBlocked(email?: string | null, phone?: string | null): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const or: Prisma.BlockedIdentityWhereInput[] = [];
    if (normalizedEmail) or.push({ email: normalizedEmail });
    if (normalizedPhone) or.push({ phone: normalizedPhone });
    if (or.length === 0) return;

    const hit = await this.prisma.blockedIdentity.findFirst({ where: { OR: or } });
    if (hit) {
      throw new ConflictException({
        code: 'identityBlocked',
        message: 'This email or phone number is blocked and cannot be used to register'
      });
    }
  }

  async list(): Promise<{ items: BlockedIdentityDto[] }> {
    const rows = await this.prisma.blockedIdentity.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: rows };
  }

  async unblock(id: string): Promise<void> {
    try {
      await this.prisma.blockedIdentity.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Blocked identity not found');
      }
      throw error;
    }
  }
}
