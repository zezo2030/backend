import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Property, PropertyImage } from '@prisma/client';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { Role } from '../../common/enums/role.enum.js';
import { decimalToNumber } from '../../common/prisma/decimal.util.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { PropertiesFeedQueryDto } from './dto/properties-query.dto.js';
import { AvailabilityStatus, ModerationStatus } from './property.enums.js';

export interface DisplayProfileDto {
  id: string;
  displayName: string;
  role: Role;
  avatarUrl: string | null;
  officeName: string | null;
}

export interface PropertySummaryDto {
  id: string;
  title: string;
  propertyType: string;
  listingType: string;
  price: number;
  currency: string;
  city: string;
  area: string;
  rooms: number;
  sizeSqm: number;
  availabilityStatus: string;
  primaryImageUrl: string | null;
  createdAt: Date;
}

export interface PropertyDto extends Omit<PropertySummaryDto, 'primaryImageUrl'> {
  owner: DisplayProfileDto;
  description: string;
  address: string | null;
  bathrooms: number;
  floor: number | null;
  finishing: string | null;
  furnished: string | null;
  moderationStatus: string;
  rejectionReason: string | null;
  viewsCount: number;
  images: Array<{ url: string; sortOrder: number }>;
  updatedAt: Date;
}

export interface ContactInfoDto {
  email: string;
  phone: string | null;
  whatsappUrl: string | null;
}

export const propertyInclude = {
  images: true
} satisfies Prisma.PropertyInclude;

export type PropertyWithImages = Property & {
  images: PropertyImage[];
};

@Injectable()
export class PropertiesQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStoreUrls: ObjectStoreUrlService,
    private readonly auditLogger: AuditLogger
  ) {}

  async findFeed(query: PropertiesFeedQueryDto): Promise<{
    items: PropertySummaryDto[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const where = this.buildFeedWhere(query);
    const docs = await this.prisma.property.findMany({
      where,
      include: propertyInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    });

    const pageItems = docs.slice(0, limit);
    return {
      items: await Promise.all(pageItems.map((property) => this.toSummaryDto(property))),
      nextCursor:
        docs.length > limit && pageItems.length > 0
          ? this.encodeCursor(pageItems[pageItems.length - 1]!)
          : null
    };
  }

  async findDetail(id: string): Promise<PropertyDto> {
    const property = await this.findVisibleProperty(id);
    await this.prisma.property.update({
      where: { id: property.id },
      data: { viewsCount: { increment: 1 } }
    });
    const withViews = { ...property, viewsCount: property.viewsCount + 1 };
    const owner = await this.mapDisplayProfile(property.ownerId);
    return await this.toPropertyDto(withViews, owner);
  }

  async mapDto(property: PropertyWithImages): Promise<PropertyDto> {
    const owner = await this.mapDisplayProfile(property.ownerId);
    return await this.toPropertyDto(property, owner);
  }

  async revealContact(
    id: string,
    actorUserId: string,
    requestId?: string
  ): Promise<ContactInfoDto> {
    const property = await this.findVisibleProperty(id);
    const owner = await this.prisma.user.findUnique({
      where: { id: property.ownerId },
      select: { email: true, phone: true }
    });
    if (!owner) throw new NotFoundException('Property not found');

    await this.auditLogger.log({
      actorUserId,
      action: 'listing.contact_revealed',
      targetType: 'property',
      targetId: property.id,
      requestId
    });

    return {
      email: owner.email,
      phone: owner.phone ?? null,
      whatsappUrl: owner.phone ? `https://wa.me/${owner.phone.replace(/\D/g, '')}` : null
    };
  }

  private buildFeedWhere(query: PropertiesFeedQueryDto): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
      moderationStatus: ModerationStatus.active,
      ownerIsActive: true,
      availabilityStatus: { in: [AvailabilityStatus.available, AvailabilityStatus.reserved] }
    };

    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.area) where.area = { equals: query.area, mode: 'insensitive' };
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.listingType) where.listingType = query.listingType;
    if (query.rooms !== undefined) where.rooms = query.rooms;
    if (query.furnished) where.furnished = query.furnished;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {})
      };
    }
    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } }
      ];
    }

    return where;
  }

  private async findVisibleProperty(id: string): Promise<PropertyWithImages> {
    const property = await this.prisma.property.findFirst({
      where: {
        id,
        deletedAt: null,
        moderationStatus: ModerationStatus.active,
        ownerIsActive: true
      },
      include: propertyInclude
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  private async mapDisplayProfile(ownerId: string): Promise<DisplayProfileDto> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, displayName: true, role: true, avatarKey: true }
    });
    if (!owner?.role) throw new NotFoundException('Property owner not found');

    let officeName: string | null = null;
    if (owner.role === Role.Broker) {
      const profile = await this.prisma.brokerProfile.findUnique({
        where: { userId: owner.id },
        select: { officeName: true }
      });
      officeName = profile?.officeName ?? null;
    }
    if (owner.role === Role.Agency) {
      const profile = await this.prisma.agencyProfile.findUnique({
        where: { userId: owner.id },
        select: { officeName: true }
      });
      officeName = profile?.officeName ?? null;
    }

    return {
      id: owner.id,
      displayName: owner.displayName,
      role: owner.role as Role,
      avatarUrl: owner.avatarKey ? this.objectUrl(owner.avatarKey) : null,
      officeName
    };
  }

  private async toSummaryDto(property: PropertyWithImages): Promise<PropertySummaryDto> {
    const primary = [...property.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return {
      id: property.id,
      title: property.title,
      propertyType: property.propertyType,
      listingType: property.listingType,
      price: decimalToNumber(property.price),
      currency: property.currency,
      city: property.city,
      area: property.area,
      rooms: property.rooms,
      sizeSqm: property.sizeSqm,
      availabilityStatus: property.availabilityStatus,
      primaryImageUrl: primary ? await this.mediaUrl(primary.objectKey) : null,
      createdAt: property.createdAt
    };
  }

  private async toPropertyDto(
    property: PropertyWithImages,
    owner: DisplayProfileDto
  ): Promise<PropertyDto> {
    const summary = await this.toSummaryDto(property);
    const images = await Promise.all(
      [...property.images]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => this.toImageDto(image))
    );
    return {
      ...summary,
      owner,
      description: property.description,
      address: property.address ?? null,
      bathrooms: property.bathrooms,
      floor: property.floor,
      finishing: property.finishing,
      furnished: property.furnished,
      moderationStatus: property.moderationStatus,
      rejectionReason: property.rejectionReason,
      viewsCount: property.viewsCount,
      images,
      updatedAt: property.updatedAt
    };
  }

  private async toImageDto(image: PropertyImage): Promise<{ url: string; sortOrder: number }> {
    return {
      url: await this.mediaUrl(image.objectKey),
      sortOrder: image.sortOrder
    };
  }

  private objectUrl(objectKey: string): string {
    return this.objectStoreUrls.publicUrl(objectKey);
  }

  private mediaUrl(objectKey: string): Promise<string> {
    return this.objectStoreUrls.mediaReadUrl(objectKey);
  }

  private encodeCursor(property: Property): string {
    return Buffer.from(
      JSON.stringify({ createdAt: property.createdAt.toISOString(), id: property.id })
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
