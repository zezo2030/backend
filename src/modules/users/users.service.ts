import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import { BlockedIdentityService } from '../blocklist/blocked-identity.service.js';
import type { SelectRoleDto, UpdateProfileDto } from './dto/users.dto.js';

export interface UserSelf {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role | null;
  isActive: boolean;
  isVerified: boolean;
  isOwner: boolean;
  createdAt: Date;
  isApproved?: boolean;
  officeName?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
    private readonly objectStore: ObjectStoreService,
    private readonly blocklist: BlockedIdentityService
  ) {}

  async getSelf(userId: string): Promise<UserSelf> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { brokerProfile: true }
    });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return this.toSelf(user);
  }

  async selectRole(userId: string, dto: SelectRoleDto): Promise<UserSelf> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (user.role) throw new ConflictException('Role already selected');

    if (dto.role === Role.Broker && !dto.officeName?.trim()) {
      throw new UnprocessableEntityException('officeName is required for broker role');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      include: { brokerProfile: true }
    });

    if (dto.role === Role.Broker) {
      await this.prisma.brokerProfile.upsert({
        where: { userId },
        create: {
          userId,
          officeName: dto.officeName!.trim(),
          isApproved: false,
          isFeatured: false
        },
        update: { officeName: dto.officeName!.trim() }
      });
      const finalUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { brokerProfile: true }
      });
      return this.toSelf(finalUser!);
    }

    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'user.role_changed',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: dto.role }
    });

    return this.toSelf(updated);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserSelf> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (dto.phone !== undefined && dto.phone !== user.phone) {
      await this.blocklist.assertNotBlocked(null, dto.phone);
    }
    if (dto.avatarKey && !(await this.objectStore.isValidImage(dto.avatarKey))) {
      throw new UnprocessableEntityException({
        code: 'uploadInvalidImage',
        message: 'Uploaded avatar is not a valid image'
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarKey !== undefined ? { avatarKey: dto.avatarKey } : {})
      },
      include: { brokerProfile: true }
    });
    return this.toSelf(updated);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return;
    // The sole owner / super-admin account is permanent and cannot be deleted —
    // this prevents an irreversible lockout of the locked owner credentials.
    if (user.isOwner) {
      throw new ForbiddenException({
        code: 'ownerProtected',
        message: 'The owner account cannot be deleted'
      });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      }),
      // Block this email/phone from re-registration (admin can lift it later).
      this.blocklist.buildBlockOp({
        email: user.email,
        phone: user.phone,
        reason: 'account_deleted',
        createdBy: user.id
      })
    ]);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'user.account_deleted',
      targetType: 'user',
      targetId: user.id
    });
  }

  toSelf(user: User & { brokerProfile?: any }): UserSelf {
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: user.displayName,
      phone: user.phone ?? null,
      avatarUrl: null,
      role: user.role as Role | null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isOwner: user.isOwner ?? false,
      createdAt: user.createdAt,
      isApproved: user.brokerProfile?.isApproved ?? false,
      officeName: user.brokerProfile?.officeName ?? null
    };
  }
}
