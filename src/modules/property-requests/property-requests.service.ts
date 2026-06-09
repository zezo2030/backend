import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import type { PropertyRequest } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { decimalToNumber, toDecimal } from '../../common/prisma/decimal.util.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { ModerationStatus } from '../properties/property.enums.js';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import {
  MinePropertyRequestsQueryDto,
  PropertyRequestCreateDto,
  PropertyRequestsFeedQueryDto,
  PropertyRequestUpdateDto
} from './dto/property-requests.dto.js';
import { PropertyRequestStatus } from './property-request.enums.js';

export interface PropertyRequestDto {
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
export class PropertyRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
    private readonly objectStoreUrls: ObjectStoreUrlService
  ) {}

  async create(dto: PropertyRequestCreateDto, requesterId: string): Promise<PropertyRequestDto> {
    if (dto.maxPrice <= dto.minPrice) {
      throw new UnprocessableEntityException('maxPrice must be greater than minPrice');
    }

    // New requests start in pending_review and are NOT fanned out to brokers
    // yet — the broker fan-out is triggered only once an admin approves the
    // request (see AdminPropertyRequestsService.updateStatus).
    const request = await this.prisma.propertyRequest.create({
      data: {
        requesterId,
        title: dto.title,
        description: dto.description,
        propertyType: dto.propertyType,
        requestType: dto.requestType,
        city: dto.city,
        area: dto.area,
        minPrice: toDecimal(dto.minPrice),
        maxPrice: toDecimal(dto.maxPrice),
        currency: dto.currency,
        requiredRooms: dto.requiredRooms,
        approxSizeSqm: dto.approxSizeSqm ?? null,
        isUrgent: dto.isUrgent ?? false,
        contactMethod: dto.contactMethod,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: PropertyRequestStatus.open,
        moderationStatus: ModerationStatus.pending_review
      }
    });

    return this.toDto(request, await this.mapDisplayProfile(request.requesterId));
  }

  async findFeed(query: PropertyRequestsFeedQueryDto) {
    const now = new Date();
    const limit = Math.min(query.limit ?? 20, 100);
    const where = {
      deletedAt: null,
      status: PropertyRequestStatus.open,
      moderationStatus: ModerationStatus.active,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ...(query.city ? [{ city: { equals: query.city, mode: 'insensitive' as const } }] : []),
        ...(query.area ? [{ area: { equals: query.area, mode: 'insensitive' as const } }] : []),
        ...(query.cursor ? [this.buildCursorWhere(query.cursor)] : [])
      ]
    };

    const docs = await this.prisma.propertyRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    });
    const items = docs.slice(0, limit);
    return {
      items: await Promise.all(items.map((item) => this.toDtoWithRequester(item))),
      nextCursor:
        docs.length > limit && items.length > 0 ? this.encodeCursor(items[items.length - 1]!) : null
    };
  }

  async findMine(requesterId: string, query: MinePropertyRequestsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = { requesterId, deletedAt: null };
    const [items, totalItems] = await Promise.all([
      this.prisma.propertyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.propertyRequest.count({ where })
    ]);

    return {
      items: await Promise.all(items.map((item) => this.toDtoWithRequester(item))),
      pageInfo: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
    };
  }

  async findOne(
    id: string,
    callerId: string,
    callerRole: Role | null
  ): Promise<PropertyRequestDto> {
    const request = await this.findExisting(id);
    if (!this.canRead(request, callerId, callerRole)) throw new ForbiddenException('Forbidden');
    return this.toDtoWithRequester(request);
  }

  async updateOwn(
    id: string,
    requesterId: string,
    dto: PropertyRequestUpdateDto
  ): Promise<PropertyRequestDto> {
    const data: Record<string, unknown> = { ...dto };
    if (dto.minPrice !== undefined) data.minPrice = toDecimal(dto.minPrice);
    if (dto.maxPrice !== undefined) data.maxPrice = toDecimal(dto.maxPrice);
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    try {
      const request = await this.prisma.propertyRequest.update({
        where: { id, requesterId, deletedAt: null },
        data
      });
      return this.toDtoWithRequester(request);
    } catch {
      throw new NotFoundException('Property request not found');
    }
  }

  async softDelete(id: string, callerId: string, callerRole: Role | null): Promise<void> {
    const request = await this.findExisting(id);
    if (request.requesterId !== callerId && callerRole !== Role.Admin) {
      throw new ForbiddenException('Forbidden');
    }
    await this.prisma.propertyRequest.update({
      where: { id: request.id },
      data: { deletedAt: new Date() }
    });
  }

  async revealContact(id: string, actorUserId: string, requestId?: string) {
    const request = await this.findExisting(id);
    const requester = await this.prisma.user.findUnique({
      where: { id: request.requesterId },
      select: { email: true, phone: true, displayName: true }
    });
    if (!requester) throw new NotFoundException('Property request not found');
    await this.auditLogger.log({
      actorUserId,
      action: 'request.contact_revealed',
      targetType: 'property_request',
      targetId: request.id,
      requestId
    });
    // A per-listing contact override (set/corrected by an admin) takes
    // precedence over the requester account's own contact details.
    const phone = request.contactPhone ?? requester.phone ?? null;
    return {
      name: request.contactName ?? requester.displayName,
      email: requester.email,
      phone,
      whatsappUrl: phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null
    };
  }

  private async findExisting(id: string): Promise<PropertyRequest> {
    const request = await this.prisma.propertyRequest.findFirst({
      where: { id, deletedAt: null }
    });
    if (!request) throw new NotFoundException('Property request not found');
    return request;
  }

  private canRead(request: PropertyRequest, callerId: string, callerRole: Role | null): boolean {
    // The owner and admins can always see the request (including while it is
    // pending review). Brokers may only see it once it has been approved.
    if (request.requesterId === callerId || callerRole === Role.Admin) return true;
    return callerRole === Role.Broker && request.moderationStatus === ModerationStatus.active;
  }

  private async toDtoWithRequester(request: PropertyRequest): Promise<PropertyRequestDto> {
    return this.toDto(request, await this.mapDisplayProfile(request.requesterId));
  }

  private async mapDisplayProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, role: true, avatarKey: true }
    });
    if (!user?.role) throw new NotFoundException('Requester not found');
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
      avatarUrl: user.avatarKey ? this.objectUrl(user.avatarKey) : null,
      officeName
    };
  }

  private toDto(
    request: PropertyRequest,
    requester: Awaited<ReturnType<PropertyRequestsService['mapDisplayProfile']>>
  ): PropertyRequestDto {
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

  private buildCursorWhere(cursor: string) {
    const decoded = this.decodeCursor(cursor);
    return {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } }
      ]
    };
  }

  private objectUrl(objectKey: string): string {
    return this.objectStoreUrls.publicUrl(objectKey);
  }

  private encodeCursor(request: PropertyRequest): string {
    return Buffer.from(
      JSON.stringify({ createdAt: request.createdAt.toISOString(), id: request.id })
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        createdAt: string;
        id: string;
      };
      return { createdAt: new Date(decoded.createdAt), id: decoded.id };
    } catch {
      throw new NotFoundException('Invalid cursor');
    }
  }
}
