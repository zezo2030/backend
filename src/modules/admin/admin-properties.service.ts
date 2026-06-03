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
import { ModerationStatus } from '../properties/property.enums.js';
import { ModerationAction, type AdminPropertyModerationDto } from './dto/admin-properties.dto.js';
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
    const where = query.moderationStatus ? { moderationStatus: query.moderationStatus } : {};

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
}
