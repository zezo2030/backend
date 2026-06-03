import { Injectable, NotFoundException } from '@nestjs/common';
import type { Favorite, Property, PropertyImage } from '@prisma/client';
import { decimalToNumber } from '../../common/prisma/decimal.util.js';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ModerationStatus } from '../properties/property.enums.js';

export interface FavoritePropertySummaryDto {
  id: string;
  title: string;
  propertyType: string;
  listingType: string;
  price: number;
  currency: string;
  cityId: string;
  areaId: string;
  rooms: number;
  sizeSqm: number;
  availabilityStatus: string;
  primaryImageUrl: string | null;
  createdAt: Date;
}

type PropertyWithImages = Property & { images: PropertyImage[] };

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStoreUrls: ObjectStoreUrlService
  ) {}

  async favorite(userId: string, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true }
    });
    if (!property) throw new NotFoundException('Property not found');

    await this.prisma.favorite.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {}
    });
  }

  async unfavorite(userId: string, propertyId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, propertyId } });
  }

  async list(
    userId: string,
    cursor: string | undefined,
    limit: number
  ): Promise<{ items: FavoritePropertySummaryDto[]; nextCursor: string | null }> {
    const where = {
      userId,
      ...(cursor ? this.buildCursorWhere(cursor) : {})
    };

    const docs = await this.prisma.favorite.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    });

    const pageItems = docs.slice(0, limit);
    const propertyIds = pageItems.map((favorite) => favorite.propertyId);
    const properties =
      propertyIds.length > 0
        ? await this.prisma.property.findMany({
            where: {
              id: { in: propertyIds },
              deletedAt: null,
              moderationStatus: ModerationStatus.active,
              ownerIsActive: true
            },
            include: { images: true }
          })
        : [];
    const propertyById = new Map(properties.map((property) => [property.id, property]));

    const items = pageItems
      .map((favorite) => propertyById.get(favorite.propertyId))
      .filter((property): property is PropertyWithImages => Boolean(property))
      .map((property) => this.toSummaryDto(property));

    return {
      items,
      nextCursor:
        docs.length > limit && pageItems.length > 0
          ? this.encodeCursor(pageItems[pageItems.length - 1]!)
          : null
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

  private toSummaryDto(property: PropertyWithImages): FavoritePropertySummaryDto {
    const primary = [...property.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return {
      id: property.id,
      title: property.title,
      propertyType: property.propertyType,
      listingType: property.listingType,
      price: decimalToNumber(property.price),
      currency: property.currency,
      cityId: property.cityId,
      areaId: property.areaId,
      rooms: property.rooms,
      sizeSqm: property.sizeSqm,
      availabilityStatus: property.availabilityStatus,
      primaryImageUrl: primary ? this.objectUrl(primary.objectKey) : null,
      createdAt: property.createdAt
    };
  }

  private objectUrl(objectKey: string): string {
    return this.objectStoreUrls.publicUrl(objectKey);
  }

  private encodeCursor(favorite: Favorite): string {
    return Buffer.from(
      JSON.stringify({ createdAt: favorite.createdAt.toISOString(), id: favorite.id })
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
