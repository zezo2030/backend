import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import {
  PropertiesQueryService,
  propertyInclude,
  type PropertyDto
} from '../properties/properties.query.service.js';
import { toDecimal } from '../../common/prisma/decimal.util.js';
import type { PropertyUpdateDto } from '../properties/dto/property-write.dto.js';
import { ModerationStatus } from '../properties/property.enums.js';
import {
  ModerationAction,
  type AdminPropertyModerationDto,
  type AdminPropertyStatusDto
} from './dto/admin-properties.dto.js';
import type { AdminPropertiesListQueryDto } from './dto/admin-properties.dto.js';

@Injectable()
export class AdminPropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertiesQueryService,
    private readonly auditLogger: AuditLogger
  ) {}

  async list(query: AdminPropertiesListQueryDto): Promise<{
    items: PropertyDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.PropertyWhereInput = { deletedAt: null };
    if (query.moderationStatus) where.moderationStatus = query.moderationStatus;
    if (query.id) where.id = query.id;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: search },
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { area: { contains: search, mode: 'insensitive' } },
        { owner: { displayName: { contains: search, mode: 'insensitive' } } },
        { owner: { email: { contains: search, mode: 'insensitive' } } },
        { owner: { phone: { contains: search, mode: 'insensitive' } } },
        ...this.dateSearch(search)
      ];
    }

    const [docs, totalItems] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: propertyInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.property.count({ where })
    ]);

    const items = await Promise.all(docs.map((doc) => this.query.mapDto(doc)));
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

  async moderate(
    id: string,
    dto: AdminPropertyModerationDto,
    actorUserId: string
  ): Promise<PropertyDto> {
    let data: Prisma.PropertyUpdateInput;
    if (dto.action === ModerationAction.Approve) {
      data = { moderationStatus: ModerationStatus.active, rejectionReason: null };
    } else if (dto.action === ModerationAction.Reject) {
      if (!dto.reason?.trim()) {
        throw new UnprocessableEntityException({
          code: 'rejectionReasonRequired',
          message: 'reason is required when rejecting a listing'
        });
      }
      data = {
        moderationStatus: ModerationStatus.rejected,
        rejectionReason: dto.reason.trim()
      };
    } else {
      throw new BadRequestException('Unsupported action');
    }

    let property;
    try {
      property = await this.prisma.property.update({
        where: { id },
        data,
        include: propertyInclude
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: dto.action === ModerationAction.Approve ? 'listing.approved' : 'listing.rejected',
      targetType: 'property',
      targetId: property.id,
      metadata: dto.action === ModerationAction.Reject ? { reason: dto.reason } : undefined
    });

    return this.query.mapDto(property);
  }

  async updateDetails(
    id: string,
    dto: PropertyUpdateDto,
    actorUserId: string
  ): Promise<PropertyDto> {
    const data: Prisma.PropertyUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = toDecimal(dto.price);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.rooms !== undefined) data.rooms = dto.rooms;
    if (dto.bathrooms !== undefined) data.bathrooms = dto.bathrooms;
    if (dto.sizeSqm !== undefined) data.sizeSqm = dto.sizeSqm;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.finishing !== undefined) data.finishing = dto.finishing;
    if (dto.furnished !== undefined) data.furnished = dto.furnished;

    let property;
    try {
      property = await this.prisma.property.update({
        where: { id, deletedAt: null },
        data,
        include: propertyInclude
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'listing.updated',
      targetType: 'property',
      targetId: property.id
    });

    return this.query.mapDto(property);
  }

  async updateStatus(
    id: string,
    dto: AdminPropertyStatusDto,
    actorUserId: string
  ): Promise<PropertyDto> {
    const data: Prisma.PropertyUpdateInput = {};

    if (dto.moderationStatus !== undefined) {
      data.moderationStatus = dto.moderationStatus;
      if (dto.moderationStatus === ModerationStatus.rejected) {
        if (!dto.reason?.trim()) {
          throw new UnprocessableEntityException({
            code: 'rejectionReasonRequired',
            message: 'reason is required when rejecting a listing'
          });
        }
        data.rejectionReason = dto.reason.trim();
      } else {
        data.rejectionReason = null;
      }
    }
    if (dto.availabilityStatus !== undefined) {
      data.availabilityStatus = dto.availabilityStatus;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No status fields provided');
    }

    let property;
    try {
      property = await this.prisma.property.update({
        where: { id, deletedAt: null },
        data,
        include: propertyInclude
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'listing.status_updated',
      targetType: 'property',
      targetId: property.id,
      metadata: {
        moderationStatus: dto.moderationStatus,
        availabilityStatus: dto.availabilityStatus,
        reason: dto.reason
      }
    });

    return this.query.mapDto(property);
  }

  async softDelete(id: string, actorUserId: string): Promise<void> {
    let property;
    try {
      property = await this.prisma.property.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
        select: { id: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Property not found');
      }
      throw error;
    }

    await this.auditLogger.log({
      actorUserId,
      action: 'listing.deleted',
      targetType: 'property',
      targetId: property.id
    });
  }

  private dateSearch(search: string): Prisma.PropertyWhereInput[] {
    const date = new Date(search);
    if (Number.isNaN(date.getTime())) return [];

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return [{ createdAt: { gte: date, lt: nextDay } }];
  }
}
