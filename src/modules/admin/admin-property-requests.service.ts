import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma, type PropertyRequest } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { decimalToNumber, toDecimal } from '../../common/prisma/decimal.util.js';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { FanoutOutboxStatus } from '../fanout/fanout.enums.js';
import { ModerationStatus } from '../properties/property.enums.js';
import type { PropertyRequestUpdateDto } from '../property-requests/dto/property-requests.dto.js';
import type {
  AdminPropertyRequestStatusDto,
  AdminPropertyRequestsListQueryDto
} from './dto/admin-property-requests.dto.js';

export interface AdminPropertyRequestDto {
  id: string;
  requester: {
    id: string;
    displayName: string;
    role: Role;
    avatarUrl: string | null;
    officeName: string | null;
  };
  title: string;
  description: string;
  propertyType: string;
  requestType: string;
  city: string;
  area: string;
  minPrice: number;
  maxPrice: number;
  currency: string;
  requiredRooms: number;
  approxSizeSqm: number | null;
  isUrgent: boolean;
  contactMethod: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  moderationStatus: string;
  rejectionReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdminPropertyRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStoreUrls: ObjectStoreUrlService,
    private readonly auditLogger: AuditLogger
  ) {}

  async list(query: AdminPropertyRequestsListQueryDto): Promise<{
    items: AdminPropertyRequestDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.PropertyRequestWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.moderationStatus ? { moderationStatus: query.moderationStatus } : {})
    };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: search },
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { area: { contains: search, mode: 'insensitive' } },
        { requester: { displayName: { contains: search, mode: 'insensitive' } } },
        { requester: { email: { contains: search, mode: 'insensitive' } } },
        { requester: { phone: { contains: search, mode: 'insensitive' } } },
        ...this.dateSearch(search)
      ];
    }

    const [docs, totalItems] = await Promise.all([
      this.prisma.propertyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.propertyRequest.count({ where })
    ]);

    const items = await Promise.all(docs.map((doc) => this.toDto(doc)));
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

  async updateStatus(
    id: string,
    dto: AdminPropertyRequestStatusDto,
    actorUserId: string
  ): Promise<AdminPropertyRequestDto> {
    if (dto.status === undefined && dto.moderationStatus === undefined) {
      throw new BadRequestException('No status fields provided');
    }

    const existing = await this.prisma.propertyRequest.findFirst({
      where: { id, deletedAt: null },
      select: { moderationStatus: true }
    });
    if (!existing) throw new NotFoundException('Property request not found');

    const data: Prisma.PropertyRequestUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.moderationStatus !== undefined) {
      data.moderationStatus = dto.moderationStatus;
      if (dto.moderationStatus === ModerationStatus.rejected) {
        if (!dto.reason?.trim()) {
          throw new UnprocessableEntityException({
            code: 'rejectionReasonRequired',
            message: 'reason is required when rejecting a request'
          });
        }
        data.rejectionReason = dto.reason.trim();
      } else {
        data.rejectionReason = null;
      }
    }

    let request;
    try {
      request = await this.prisma.propertyRequest.update({
        where: { id, deletedAt: null },
        data
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property request not found');
      }
      throw error;
    }

    // First-time approval fans the request out to brokers. The outbox row is
    // keyed by the unique requestId, so re-approving never re-notifies.
    const justApproved =
      dto.moderationStatus === ModerationStatus.active &&
      existing.moderationStatus !== ModerationStatus.active;
    if (justApproved) {
      await this.prisma.fanoutOutbox.upsert({
        where: { requestId: request.id },
        create: { requestId: request.id, status: FanoutOutboxStatus.pending },
        update: {}
      });
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'property_request.status_updated',
      targetType: 'property_request',
      targetId: request.id,
      metadata: {
        status: dto.status,
        moderationStatus: dto.moderationStatus,
        reason: dto.reason
      }
    });

    return this.toDto(request);
  }

  async updateDetails(
    id: string,
    dto: PropertyRequestUpdateDto,
    actorUserId: string
  ): Promise<AdminPropertyRequestDto> {
    const data: Prisma.PropertyRequestUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.propertyType !== undefined) data.propertyType = dto.propertyType;
    if (dto.requestType !== undefined) data.requestType = dto.requestType;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.minPrice !== undefined) data.minPrice = toDecimal(dto.minPrice);
    if (dto.maxPrice !== undefined) data.maxPrice = toDecimal(dto.maxPrice);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.requiredRooms !== undefined) data.requiredRooms = dto.requiredRooms;
    if (dto.approxSizeSqm !== undefined) data.approxSizeSqm = dto.approxSizeSqm;
    if (dto.isUrgent !== undefined) data.isUrgent = dto.isUrgent;
    if (dto.contactMethod !== undefined) data.contactMethod = dto.contactMethod;
    if (dto.contactName !== undefined) data.contactName = dto.contactName.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    let request;
    try {
      request = await this.prisma.propertyRequest.update({
        where: { id, deletedAt: null },
        data
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property request not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'property_request.updated',
      targetType: 'property_request',
      targetId: request.id
    });

    return this.toDto(request);
  }

  async softDelete(id: string, actorUserId: string): Promise<void> {
    let request;
    try {
      request = await this.prisma.propertyRequest.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
        select: { id: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property request not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'property_request.deleted',
      targetType: 'property_request',
      targetId: request.id
    });
  }

  private async toDto(request: PropertyRequest): Promise<AdminPropertyRequestDto> {
    const requester = await this.mapDisplayProfile(request.requesterId);
    return {
      id: request.id,
      requester,
      title: request.title,
      description: request.description,
      propertyType: request.propertyType,
      requestType: request.requestType,
      city: request.city,
      area: request.area,
      minPrice: decimalToNumber(request.minPrice),
      maxPrice: decimalToNumber(request.maxPrice),
      currency: request.currency,
      requiredRooms: request.requiredRooms,
      approxSizeSqm: request.approxSizeSqm ?? null,
      isUrgent: request.isUrgent,
      contactMethod: request.contactMethod,
      contactName: request.contactName ?? null,
      contactPhone: request.contactPhone ?? null,
      status: request.status,
      moderationStatus: request.moderationStatus,
      rejectionReason: request.rejectionReason ?? null,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    };
  }

  private async mapDisplayProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, role: true, avatarKey: true }
    });
    if (!user?.role) {
      return {
        id: userId,
        displayName: 'Unknown',
        role: Role.RegularUser,
        avatarUrl: null,
        officeName: null
      };
    }
    let officeName: string | null = null;
    if (user.role === Role.Broker) {
      const profile = await this.prisma.brokerProfile.findUnique({
        where: { userId: user.id },
        select: { officeName: true }
      });
      officeName = profile?.officeName ?? null;
    }
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role as Role,
      avatarUrl: user.avatarKey ? this.objectStoreUrls.publicUrl(user.avatarKey) : null,
      officeName
    };
  }

  private dateSearch(search: string): Prisma.PropertyRequestWhereInput[] {
    const date = new Date(search);
    if (Number.isNaN(date.getTime())) return [];

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return [{ createdAt: { gte: date, lt: nextDay } }];
  }
}
