import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
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
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger
  ) {}

  async getSelf(userId: string): Promise<UserSelf> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return this.toSelf(user);
  }

  async selectRole(userId: string, dto: SelectRoleDto): Promise<UserSelf> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (user.role) throw new ConflictException('Role already selected');

    if ((dto.role === Role.Broker || dto.role === Role.Agency) && !dto.officeName?.trim()) {
      throw new UnprocessableEntityException('officeName is required for broker and agency roles');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role }
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
    } else if (dto.role === Role.Agency) {
      await this.prisma.agencyProfile.upsert({
        where: { userId },
        create: {
          userId,
          officeName: dto.officeName!.trim(),
          isApproved: false,
          isFeatured: false
        },
        update: { officeName: dto.officeName!.trim() }
      });
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
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarKey !== undefined ? { avatarKey: dto.avatarKey } : {})
      }
    });
    return this.toSelf(updated);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) return;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
    await this.auditLogger.log({
      actorUserId: user.id,
      action: 'user.account_deleted',
      targetType: 'user',
      targetId: user.id
    });
  }

  toSelf(user: User): UserSelf {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone ?? null,
      avatarUrl: null,
      role: user.role as Role | null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };
  }
}
