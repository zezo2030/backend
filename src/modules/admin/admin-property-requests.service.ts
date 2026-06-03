import { Injectable } from '@nestjs/common';
import type { PropertyRequest } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { decimalToNumber } from '../../common/prisma/decimal.util.js';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AdminPropertyRequestsListQueryDto } from './dto/admin-property-requests.dto.js';

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
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdminPropertyRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStoreUrls: ObjectStoreUrlService
  ) {}

  async list(query: AdminPropertyRequestsListQueryDto): Promise<{
    items: AdminPropertyRequestDto[];
    pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {})
    };

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
      status: request.status,
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
    if (user.role === Role.Agency) {
      const profile = await this.prisma.agencyProfile.findUnique({
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
}
