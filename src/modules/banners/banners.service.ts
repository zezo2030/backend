import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type Banner, BannerLinkType } from '@prisma/client';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import { ObjectStoreUrlService } from '../../infra/objectstore/object-store-url.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ModerationStatus, AvailabilityStatus } from '../properties/property.enums.js';
import type { CreateBannerDto, ReorderBannersDto, UpdateBannerDto } from './dto/banner.dto.js';

export interface BannerDto {
  id: string;
  imageUrl: string;
  title: string | null;
  linkType: BannerLinkType;
  propertyId: string | null;
  url: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStore: ObjectStoreService,
    private readonly objectStoreUrls: ObjectStoreUrlService
  ) {}

  /** Active banners for the mobile slider, ordered by sortOrder then newest. */
  async listPublic(): Promise<{ items: BannerDto[] }> {
    const rows = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });
    return { items: await Promise.all(rows.map((row) => this.toDto(row))) };
  }

  /** All banners for the admin dashboard. */
  async listAdmin(): Promise<{ items: BannerDto[] }> {
    const rows = await this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });
    return { items: await Promise.all(rows.map((row) => this.toDto(row))) };
  }

  async create(dto: CreateBannerDto): Promise<BannerDto> {
    await this.assertValidImage(dto.imageObjectKey);
    const { propertyId, url } = await this.resolveLink(dto.linkType, dto.propertyId, dto.url);
    const created = await this.prisma.banner.create({
      data: {
        imageObjectKey: dto.imageObjectKey,
        title: dto.title?.trim() || null,
        linkType: dto.linkType,
        propertyId,
        url,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true
      }
    });
    return this.toDto(created);
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerDto> {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');

    if (dto.imageObjectKey && dto.imageObjectKey !== existing.imageObjectKey) {
      await this.assertValidImage(dto.imageObjectKey);
    }

    const nextLinkType = dto.linkType ?? existing.linkType;
    const data: Prisma.BannerUpdateInput = {};
    if (dto.imageObjectKey !== undefined) data.imageObjectKey = dto.imageObjectKey;
    if (dto.title !== undefined) data.title = dto.title?.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // When the link target changes, re-resolve so we never persist an orphaned
    // propertyId/url that doesn't match the (possibly new) linkType.
    if (dto.linkType !== undefined || dto.propertyId !== undefined || dto.url !== undefined) {
      const resolved = await this.resolveLink(
        nextLinkType,
        dto.propertyId !== undefined
          ? (dto.propertyId ?? undefined)
          : (existing.propertyId ?? undefined),
        dto.url !== undefined ? (dto.url ?? undefined) : (existing.url ?? undefined)
      );
      data.linkType = nextLinkType;
      data.property = resolved.propertyId
        ? { connect: { id: resolved.propertyId } }
        : { disconnect: true };
      data.url = resolved.url;
    }

    const updated = await this.prisma.banner.update({ where: { id }, data });
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.banner.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Banner not found');
      }
      throw error;
    }
  }

  async reorder(dto: ReorderBannersDto): Promise<{ items: BannerDto[] }> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder }
        })
      )
    );
    return this.listAdmin();
  }

  private async assertValidImage(objectKey: string): Promise<void> {
    if (!(await this.objectStore.isValidImage(objectKey))) {
      throw new UnprocessableEntityException({
        code: 'uploadInvalidImage',
        message: 'Banner image is not a valid image'
      });
    }
  }

  private async resolveLink(
    linkType: BannerLinkType,
    propertyId?: string,
    url?: string
  ): Promise<{ propertyId: string | null; url: string | null }> {
    if (linkType === BannerLinkType.property) {
      if (!propertyId) {
        throw new UnprocessableEntityException({
          code: 'bannerPropertyRequired',
          message: 'propertyId is required when linkType is property'
        });
      }
      const property = await this.prisma.property.findFirst({
        where: {
          id: propertyId,
          deletedAt: null,
          moderationStatus: ModerationStatus.active,
          availabilityStatus: {
            in: [AvailabilityStatus.available, AvailabilityStatus.reserved]
          }
        },
        select: { id: true }
      });
      if (!property) {
        throw new UnprocessableEntityException({
          code: 'bannerPropertyNotFound',
          message: 'Linked property does not exist or is not published'
        });
      }
      return { propertyId, url: null };
    }
    if (linkType === BannerLinkType.url) {
      if (!url) {
        throw new UnprocessableEntityException({
          code: 'bannerUrlRequired',
          message: 'url is required when linkType is url'
        });
      }
      return { propertyId: null, url };
    }
    return { propertyId: null, url: null };
  }

  private async toDto(row: Banner): Promise<BannerDto> {
    return {
      id: row.id,
      imageUrl: await this.objectStoreUrls.mediaReadUrl(row.imageObjectKey),
      title: row.title,
      linkType: row.linkType,
      propertyId: row.propertyId,
      url: row.url,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
