import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
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
  isOwner: boolean;
  createdAt: Date;
  propertyCount: number;
  propertyRequestCount: number;
  openReportCount: number;
  isApproved?: boolean;
  officeName?: string | null;
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
        take: pageSize,
        // Compute per-user counts via filtered relation aggregates in a single
        // query instead of firing 2 extra queries per row (N+1). Fanning out
        // ~2*pageSize concurrent queries previously exhausted the connection
        // pool and surfaced as 500s under a session-mode pooler.
        select: {
          id: true,
          email: true,
          displayName: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          isOwner: true,
          createdAt: true,
          brokerProfile: {
            select: {
              isApproved: true,
              officeName: true
            }
          },
          _count: {
            select: {
              ownedProperties: { where: { deletedAt: null } },
              propertyRequests: {
                where: {
                  deletedAt: null,
                  status: {
                    in: [PropertyRequestStatus.open, PropertyRequestStatus.in_progress]
                  }
                }
              }
            }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    const items: UserAdminViewDto[] = docs.map((doc) => ({
      id: doc.id,
      email: doc.email ?? '',
      displayName: doc.displayName,
      phone: doc.phone ?? null,
      avatarUrl: null,
      role: doc.role as Role | null,
      isActive: doc.isActive,
      isVerified: doc.isVerified,
      isOwner: doc.isOwner,
      createdAt: doc.createdAt,
      propertyCount: doc._count.ownedProperties,
      propertyRequestCount: doc._count.propertyRequests,
      openReportCount: 0,
      isApproved: doc.brokerProfile?.isApproved ?? false,
      officeName: doc.brokerProfile?.officeName ?? null
    }));
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
    await this.assertCanModifyTarget(user, actorUserId);

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

  async approveBroker(userId: string, actorUserId: string): Promise<UserAdminViewDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertCanModifyTarget(user, actorUserId);
    if (user.role !== Role.Broker) throw new BadRequestException('User is not a broker');

    await this.prisma.brokerProfile.update({
      where: { userId },
      data: { isApproved: true }
    });

    await this.auditLogger.log({
      actorUserId,
      action: 'admin.broker_approved',
      targetType: 'user',
      targetId: userId
    });

    return this.toView(user);
  }

  /**
   * The owner / super-admin account is edit-locked: only the owner may modify
   * their own account; no other admin can touch it.
   */
  private async assertCanModifyTarget(
    target: { id: string; isOwner: boolean },
    actorUserId: string
  ): Promise<void> {
    if (!target.isOwner) return;
    if (target.id === actorUserId) return;
    throw new ForbiddenException({
      code: 'ownerProtected',
      message: 'The owner account cannot be modified by another admin'
    });
  }

  private async toView(user: {
    id: string;
    email: string | null;
    displayName: string;
    phone: string | null;
    role: string | null;
    isActive: boolean;
    isVerified: boolean;
    isOwner: boolean;
    createdAt: Date;
  }): Promise<UserAdminViewDto> {
    const [propertyCount, propertyRequestCount, brokerProfile] = await Promise.all([
      this.prisma.property.count({ where: { ownerId: user.id, deletedAt: null } }),
      this.prisma.propertyRequest.count({
        where: {
          requesterId: user.id,
          deletedAt: null,
          status: { in: [PropertyRequestStatus.open, PropertyRequestStatus.in_progress] }
        }
      }),
      this.prisma.brokerProfile.findUnique({ where: { userId: user.id } })
    ]);
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: user.displayName,
      phone: user.phone ?? null,
      avatarUrl: null,
      role: user.role as Role | null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isOwner: user.isOwner,
      createdAt: user.createdAt,
      propertyCount,
      propertyRequestCount,
      openReportCount: 0,
      isApproved: brokerProfile?.isApproved ?? false,
      officeName: brokerProfile?.officeName ?? null
    };
  }
}
