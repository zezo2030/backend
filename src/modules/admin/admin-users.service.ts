import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { PropertyRequestStatus } from '../property-requests/property-request.enums.js';
import type { AdminUsersListQueryDto } from './dto/admin-users.dto.js';

export interface UserAdminViewDto {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  propertyCount: number;
  propertyRequestCount: number;
  openReportCount: number;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger
  ) {}

  async list(query: AdminUsersListQueryDto): Promise<{
    items: UserAdminViewDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) where.role = query.role;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } }
      ];
    }

    const [docs, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.user.count({ where })
    ]);

    const items = await Promise.all(docs.map((doc) => this.toView(doc)));
    return {
      items,
      pageInfo: {
        page,
        pageSize,
        totalItems,
        totalPages: pageSize === 0 ? 0 : Math.ceil(totalItems / pageSize)
      }
    };
  }

  async setStatus(
    userId: string,
    isActive: boolean,
    actorUserId: string,
    reason?: string
  ): Promise<UserAdminViewDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive,
        ...(isActive ? {} : { tokenVersion: { increment: 1 } })
      }
    });

    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    await this.prisma.property.updateMany({
      where: { ownerId: user.id },
      data: { ownerIsActive: isActive }
    });

    await this.auditLogger.log({
      actorUserId,
      action: isActive ? 'admin.user_enabled' : 'admin.user_disabled',
      targetType: 'user',
      targetId: user.id,
      metadata: reason ? { reason } : undefined
    });

    return this.toView(updated);
  }

  private async toView(user: {
    id: string;
    email: string;
    displayName: string;
    phone: string | null;
    role: string | null;
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date;
  }): Promise<UserAdminViewDto> {
    const [propertyCount, propertyRequestCount] = await Promise.all([
      this.prisma.property.count({ where: { ownerId: user.id, deletedAt: null } }),
      this.prisma.propertyRequest.count({
        where: {
          requesterId: user.id,
          deletedAt: null,
          status: { in: [PropertyRequestStatus.open, PropertyRequestStatus.in_progress] }
        }
      })
    ]);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone ?? null,
      avatarUrl: null,
      role: user.role as Role | null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      propertyCount,
      propertyRequestCount,
      openReportCount: 0
    };
  }
}
